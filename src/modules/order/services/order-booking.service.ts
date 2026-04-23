import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromoCodeService } from '../../promo-code/promo-code.service';
import { OrderQueryService } from './order-query.service';
import { OrderPricingService } from './order-pricing.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Language, Service } from '@prisma/client';
import { format } from 'date-fns';

interface ServiceWithFreeFlag extends Service {
  isFree: boolean;
}

@Injectable()
export class OrderBookingService {
  private readonly logger = new Logger(OrderBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promoCodeService: PromoCodeService,
    private readonly orderQuery: OrderQueryService,
    private readonly orderPricing: OrderPricingService,
  ) {}

  async GetData(
    createOrderDto: CreateOrderDto,
    userId: string,
    lang: Language,
  ) {
    const {
      promoCode,
      service,
      slot,
      barberId,
      date,
      branchId,
      usedPackage,
      points,
      phone,
    } = createOrderDto;
    try {
      if (points && points <= 0)
        throw new BadRequestException('You have exceeded the points limit');

      const dateWithoutTime = date.toString().split('T')[0];
      const allServices = [] as ServiceWithFreeFlag[];

      const another =
        phone &&
        phone !== '' &&
        (await this.prisma.user.findUnique({ where: { phone } }));
      userId = another ? another.id : userId;

      const FetchedServices = await this.prisma.service.findMany({
        where: { id: { in: service } },
      });
      const totalDuration = FetchedServices.reduce(
        (acc, service) => acc + service.duration,
        0,
      );

      const [order, usedPromoCode, slots, validPromoCode, user] =
        await Promise.all([
          this.prisma.order.findFirst({
            where: {
              ...(barberId && { barberId }),
              date: new Date(dateWithoutTime),
              slot,
              OR: [
                { status: 'PENDING' },
                { status: 'IN_PROGRESS' },
                { booking: 'UPCOMING' },
              ],
            },
          }),
          this.prisma.user.findFirst({
            where: { id: userId },
            select: {
              client: { select: { points: true } },
              UserOrders: { where: { promoCode, status: 'PENDING' } },
            },
          }),
          barberId
            ? (
                await this.orderPricing.getSlots(
                  dateWithoutTime,
                  barberId,
                  totalDuration,
                )
              ).slots
            : [],
          promoCode &&
            (await this.promoCodeService.validatePromoCode(promoCode)).data,
          this.prisma.user.findUnique({
            where: { id: userId },
            select: {
              client: {
                select: {
                  ban: true,
                  user: {
                    select: { firstName: true, lastName: true, phone: true },
                  },
                },
              },
              role: true,
            },
          }),
        ]);

      if (phone && !user) throw new NotFoundException('User not found');

      const settings = await this.prisma.settings.findFirst({});
      if (!settings) throw new NotFoundException('Settings not found');

      if (points && points <= 0 && settings.pointLimit > points)
        throw new BadRequestException('You have exceeded the points limit');
      if (usedPromoCode && usedPromoCode.UserOrders.length && promoCode)
        throw new ConflictException(
          `Promo code "${promoCode}" is invalid or expired.`,
        );
      if (order) throw new ConflictException(`Slot ${slot} is already booked`);
      if (barberId && !slots.includes(slot))
        throw new ServiceUnavailableException(`Slot ${slot} is Unavailable`);

      let costServices = [] as ServiceWithFreeFlag[];
      if (user?.role === 'USER') {
        const clientPackages = await this.prisma.clientPackages.findMany({
          where: {
            clientId: userId,
            packageService: {
              some: { isActive: true, remainingCount: { gt: 0 } },
            },
          },
          select: {
            id: true,
            type: true,
            isActive: true,
            packageService: { select: { service: true } },
          },
        });

        const selectedPackage = clientPackages.filter((pkg) =>
          usedPackage?.includes(pkg.id),
        );
        const notValidPackage = selectedPackage.filter((pkg) => !pkg.isActive);
        if (notValidPackage.length > 0)
          throw new BadRequestException('This package is not valid anymore');

        const single = clientPackages
          .filter((pkg) => pkg.type === 'SINGLE' && pkg.isActive)
          .flatMap((pkg) =>
            pkg.packageService.flatMap((ps) => ({
              ...ps.service,
              pkgId: pkg.id,
            })),
          );

        const services = FetchedServices.map((srv) => ({
          ...srv,
          isFree: single.some((s) => s.id === srv.id),
        }));
        allServices.push(...services);

        for (const pkg of selectedPackage) {
          if (pkg.type === 'SINGLE')
            throw new ConflictException(
              'Can not select Packages of type SINGLE',
            );
          allServices.push(
            ...pkg.packageService.flatMap((ps) => ({
              ...ps.service,
              isFree: true,
            })),
          );
        }

        costServices = allServices.filter((service) => !service.isFree);
      }
      if (user?.role !== 'USER') {
        allServices.push(
          ...FetchedServices.map((srv) => ({ ...srv, isFree: false })),
        );
        costServices = allServices;
      }

      const subTotal = costServices.reduce(
        (acc, service) => acc + service.price,
        0,
      );

      let pointsDiscount = 0;
      if (points) {
        if (points < 1000)
          throw new BadRequestException('Minimum points required is 1000');
        if (points > (usedPromoCode?.client?.points ?? 0))
          throw new BadRequestException('You do not have enough points');
        pointsDiscount = Math.floor(points / 1000) * 50;
        if (pointsDiscount > subTotal)
          throw new BadRequestException(
            'Points discount cannot exceed the subtotal',
          );
      }

      const discount = validPromoCode
        ? validPromoCode.type === 'PERCENTAGE'
          ? (subTotal * validPromoCode.discount) / 100
          : validPromoCode.discount
        : 0;
      const total = Math.max(subTotal - discount - pointsDiscount, 0);
      const duration = allServices.reduce(
        (acc, service) => acc + service.duration,
        0,
      );

      const now = new Date();
      const diffInMs = new Date(dateWithoutTime).getTime() - now.getTime();
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
      if (diffInDays >= settings.maxDaysBooking)
        throw new BadRequestException(
          `You can only book up to ${settings.maxDaysBooking} days in advance`,
        );

      const discountDisplay =
        validPromoCode && pointsDiscount > 0
          ? validPromoCode?.type === 'PERCENTAGE'
            ? `${validPromoCode?.discount}% + ${pointsDiscount}EGP`
            : `${discount}EGP + ${pointsDiscount}EGP`
          : validPromoCode
            ? validPromoCode?.type === 'PERCENTAGE'
              ? `${validPromoCode?.discount}%`
              : `${validPromoCode?.discount}EGP`
            : pointsDiscount > 0
              ? `${pointsDiscount}EGP`
              : '0';

      return {
        date: format(new Date(dateWithoutTime), 'yyyy-MM-dd'),
        slot,
        ...(barberId && { barberId }),
        branchId,
        canUsePoints:
          settings.pointLimit < (usedPromoCode?.client?.points ?? 0) ||
          settings.pointLimit > settings.pointLimit + 1,
        points: points?.toString(),
        clientName: `${user?.client?.user?.firstName} ${user?.client?.user?.lastName}`,
        clientPhone: user?.client?.user?.phone,
        createdAt: new Date(),
        updatedAt: null,
        ...(phone && { phone }),
        duration: `${duration} ${lang === 'EN' ? 'Minutes' : 'دقيقة'}`,
        promoCode: promoCode ? promoCode : null,
        subTotal: subTotal?.toString(),
        discount: discountDisplay,
        pointsDiscount: pointsDiscount.toString(),
        total: total.toString(),
        limit: settings.pointLimit.toString(),
      };
    } catch (err) {
      const error =
        err instanceof HttpException
          ? err
          : new InternalServerErrorException(err);
      this.logger.error('Error in GetData:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      if (error instanceof HttpException) throw error;
      throw new Error('Failed to get data');
    }
  }

  async createOrder(
    createOrderDto: CreateOrderDto,
    userId: string,
    lang: Language,
  ) {
    const {
      slot,
      service,
      barberId,
      branchId,
      usedPackage,
      promoCode,
      points,
      phone,
      barberName,
      ...rest
    } = createOrderDto;

    if (points !== undefined && points !== null && !Number.isInteger(points))
      throw new BadRequestException('Points must be a number');
    if (points && points < 1000)
      throw new BadRequestException('Minimum points required is 1000');

    const allServices = [] as ServiceWithFreeFlag[];
    const dateWithoutTime = createOrderDto.date.toString().split('T')[0];

    const another =
      phone && (await this.prisma.user.findUnique({ where: { phone } }));
    userId = another ? another.id : userId;

    const FetchedServices = await this.prisma.service.findMany({
      where: { id: { in: service } },
    });
    const totalDuration = FetchedServices.reduce(
      (acc, s) => acc + s.duration,
      0,
    );

    const [existingOrder, usedPromoCode, slots, validPromoCode, user] =
      await Promise.all([
        this.prisma.order.findFirst({
          where: {
            ...(barberId && { barberId }),
            date: new Date(dateWithoutTime),
            slot,
            OR: [
              { status: 'PENDING' },
              { status: 'IN_PROGRESS' },
              { booking: 'UPCOMING' },
            ],
          },
        }),
        this.prisma.user.findFirst({
          where: { id: userId },
          select: { UserOrders: { where: { promoCode, status: 'PENDING' } } },
        }),
        barberId
          ? (
              await this.orderPricing.getSlots(
                dateWithoutTime,
                barberId,
                totalDuration,
              )
            ).slots
          : [],
        promoCode &&
          (await this.promoCodeService.validatePromoCode(promoCode)).data,
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            client: { select: { points: true, ban: true } },
            role: true,
          },
        }),
      ]);

    if (!user) throw new NotFoundException('User not found');
    if (user?.client?.ban) throw new BadRequestException('You are banned');

    const settings = await this.prisma.settings.findFirst({});
    if (!settings) throw new NotFoundException('Settings not found');

    const now = new Date();
    const diffInDays =
      (new Date(dateWithoutTime).getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffInDays > settings.maxDaysBooking)
      throw new ConflictException(
        `You can only book up to ${settings.maxDaysBooking} days in advance`,
      );
    if (usedPromoCode?.UserOrders.length && promoCode)
      throw new ConflictException(
        `Promo code "${promoCode}" is invalid or expired.`,
      );
    if (existingOrder)
      throw new ConflictException(`Slot ${slot} is already booked`);
    if (barberId && !slots.includes(slot))
      throw new ServiceUnavailableException(`Slot ${slot} is Unavailable`);

    const barber = barberId
      ? await this.prisma.barber.findUnique({
          where: { id: barberId },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
      : null;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    const Services = await this.prisma.service.findMany({
      where: { id: { in: service } },
    });

    if (barberId && !barber) throw new NotFoundException('Barber not found');
    if (!branch) throw new NotFoundException('Branch not found');
    if (!Services || !Services.length)
      throw new NotFoundException('Service not found');

    const clientPackages = await this.prisma.clientPackages.findMany({
      where: {
        clientId: userId,
        packageService: { some: { isActive: true, remainingCount: { gt: 0 } } },
      },
      select: {
        id: true,
        type: true,
        isActive: true,
        packageService: { select: { service: true } },
      },
    });

    const selectedPackage = clientPackages.filter((pkg) =>
      usedPackage?.includes(pkg.id),
    );
    const notValidPackage = selectedPackage.filter((pkg) => !pkg.isActive);
    if (notValidPackage.length > 0)
      throw new BadRequestException('This package is not valid anymore');

    const single = clientPackages
      .filter((pkg) => pkg.type === 'SINGLE')
      .flatMap((pkg) =>
        pkg.packageService.flatMap((ps) => ({ ...ps.service, pkgId: pkg.id })),
      );

    allServices.push(
      ...FetchedServices.map((srv) => ({
        ...srv,
        isFree: single.some((s) => s.id === srv.id),
      })),
    );

    for (const pkg of selectedPackage) {
      if (pkg.type === 'SINGLE')
        throw new ConflictException('Can not select Packages of type SINGLE');
      allServices.push(
        ...pkg.packageService.flatMap((ps) => ({
          ...ps.service,
          isFree: true,
        })),
      );
    }

    const costServices = allServices.filter((s) => !s.isFree);
    const subTotal = costServices.reduce((acc, s) => acc + s.price, 0);

    let pointsToUse = 0;
    let pointsDiscount = 0;
    if (points) {
      if (points < 1000)
        throw new BadRequestException('Minimum points required is 1000');
      if (points > user?.client?.points)
        throw new BadRequestException('You do not have enough points');
      pointsDiscount = Math.floor(points / 1000) * 50;
      if (pointsDiscount > subTotal)
        throw new BadRequestException(
          'Points discount cannot exceed the subtotal',
        );
      pointsToUse = points;
    }

    const discount = promoCode
      ? validPromoCode?.type === 'PERCENTAGE'
        ? (subTotal * validPromoCode?.discount) / 100
        : validPromoCode?.discount
      : 0;
    const total = Math.max(subTotal - discount - pointsDiscount, 0);

    if (user?.client?.ban) throw new ForbiddenException('You are banned');

    let order;

    if (user.role === 'USER') {
      order = await this.prisma.order.create({
        data: {
          ...rest,
          ...(validPromoCode && { promoCode }),
          slot,
          userId,
          ...(barberId && { barberId }),
          barberName: `${barber?.user.firstName} ${barber?.user.lastName}`,
          branchId,
          points: pointsToUse,
          usedPackage: selectedPackage
            ? selectedPackage.flatMap((e) => e.id)
            : [],
          date: new Date(dateWithoutTime),
          service: { connect: allServices.map((s) => ({ id: s.id })) },
          subTotal,
          total,
        },
        include: {
          service: { include: { PackagesServices: { select: { id: true } } } },
        },
      });

      const packageServiceIds = order.service.flatMap((s) =>
        s.PackagesServices.map((ps) => ps.id),
      );
      await this.prisma.$transaction(async (prisma) => {
        const packageService = await prisma.packagesServices.findMany({
          where: {
            id: { in: packageServiceIds },
            ClientPackages: { clientId: order.userId, type: 'SINGLE' },
            isActive: true,
          },
        });
        const pkgServiceIds = packageService.flatMap((ps) => ps.id);
        if (pkgServiceIds.length > 0) {
          await prisma.packagesServices.updateMany({
            where: {
              id: { in: pkgServiceIds },
              ClientPackages: { clientId: order.userId, type: 'SINGLE' },
              isActive: true,
            },
            data: {
              ...(packageService[0].remainingCount < 1 && { isActive: false }),
              usedAt: new Date(),
              remainingCount: { decrement: 1 },
            },
          });
        }
        if (selectedPackage) {
          await this.prisma.clientPackages.updateMany({
            where: {
              id: { in: usedPackage },
              clientId: order.userId,
              type: 'MULTIPLE',
            },
            data: { isActive: false },
          });
        }
      });
      if (pointsToUse > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { client: { update: { points: { decrement: pointsToUse } } } },
        });
      }
    } else {
      order = await this.prisma.order.create({
        data: {
          ...rest,
          ...(validPromoCode && { promoCode }),
          slot,
          userId,
          barberId,
          barberName:
            barberName || `${barber?.user.firstName} ${barber?.user.lastName}`,
          branchId,
          points: pointsToUse,
          discount: validPromoCode ? validPromoCode.discount : 0,
          type: validPromoCode ? validPromoCode.type : 'AMOUNT',
          usedPackage: selectedPackage
            ? selectedPackage.flatMap((e) => e.id)
            : [],
          freeService: allServices.filter((s) => s.isFree).flatMap((s) => s.id),
          date: new Date(dateWithoutTime),
          service: { connect: allServices.map((s) => ({ id: s.id })) },
          subTotal,
          total,
        },
        include: {
          service: { include: { PackagesServices: { select: { id: true } } } },
        },
      });
    }

    const duration = allServices.reduce((acc, s) => acc + s.duration, 0);
    const discountDisplay =
      promoCode && pointsDiscount > 0
        ? validPromoCode?.type === 'PERCENTAGE'
          ? `${validPromoCode?.discount}% + ${pointsDiscount}EGP`
          : `${discount}EGP + ${pointsDiscount}EGP`
        : promoCode
          ? validPromoCode?.type === 'PERCENTAGE'
            ? `${validPromoCode?.discount}%`
            : `${validPromoCode?.discount}EGP`
          : pointsDiscount > 0
            ? `${pointsDiscount}EGP`
            : '0';

    return {
      date: format(order.date, 'yyyy-MM-dd'),
      slot: order.slot,
      ...(barberId && { barberId: order.barberId }),
      branchId: order.branchId,
      barberName: order.barberName,
      points: order.points?.toString(),
      createdAt: order.createdAt,
      updatedAt: null,
      duration: `${duration} ${lang === 'AR' ? 'دقيقة' : 'minutes'}`,
      promoCode: promoCode ? promoCode : null,
      subTotal: order.subTotal?.toString(),
      discount: discountDisplay,
      total: order.total?.toString(),
    };
  }
}
