import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Language } from '@prisma/client';
import { format } from 'date-fns';
import { OrderSharedService } from './order-shared.service';

@Injectable()
export class OrderCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderShared: OrderSharedService,
  ) {}

  async execute(
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

    const dateWithoutTime = createOrderDto.date.toString().split('T')[0];

    const resolvedUserId = await this.orderShared.resolveUserId(phone, userId);
    const { fetchedServices, totalDuration } =
      await this.orderShared.fetchServices(service);

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
          where: { id: resolvedUserId },
          select: { UserOrders: { where: { promoCode, status: 'PENDING' } } },
        }),
        this.orderShared.fetchSlots(barberId, dateWithoutTime, totalDuration),
        this.orderShared.validatePromoCode(promoCode),
        this.prisma.user.findUnique({
          where: { id: resolvedUserId },
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

    const diffInDays =
      (new Date(dateWithoutTime).getTime() - new Date().getTime()) /
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

    const [barber, branch] = await Promise.all([
      barberId
        ? this.prisma.barber.findUnique({
            where: { id: barberId },
            include: { user: { select: { firstName: true, lastName: true } } },
          })
        : null,
      this.prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    if (barberId && !barber) throw new NotFoundException('Barber not found');
    if (!branch) throw new NotFoundException('Branch not found');
    if (!fetchedServices.length)
      throw new NotFoundException('Service not found');

    const { allServices, costServices } =
      await this.orderShared.resolveServiceList(
        resolvedUserId,
        user.role,
        fetchedServices,
        usedPackage,
      );

    const { subTotal, pointsDiscount, discount, total } =
      this.orderShared.calculatePricing(
        costServices,
        points,
        null,
        validPromoCode,
      );

    let pointsToUse = 0;
    if (points) {
      if (points > (user?.client?.points ?? 0))
        throw new BadRequestException('You do not have enough points');
      pointsToUse = points;
    }

    if (user?.client?.ban) throw new ForbiddenException('You are banned');

    let order;

    if (user.role === 'USER') {
      order = await this.prisma.order.create({
        data: {
          ...rest,
          ...(validPromoCode && { promoCode }),
          slot,
          userId: resolvedUserId,
          ...(barberId && { barberId }),
          barberName: `${barber?.user.firstName} ${barber?.user.lastName}`,
          branchId,
          points: pointsToUse,
          usedPackage: allServices
            .filter((s) => s.isFree)
            .map((s) => s.id),
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
        const pkgServiceIds = packageService.map((ps) => ps.id);
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
        if (usedPackage?.length) {
          await prisma.clientPackages.updateMany({
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
          where: { id: resolvedUserId },
          data: { client: { update: { points: { decrement: pointsToUse } } } },
        });
      }
    } else {
      order = await this.prisma.order.create({
        data: {
          ...rest,
          ...(validPromoCode && { promoCode }),
          slot,
          userId: resolvedUserId,
          barberId,
          barberName:
            barberName || `${barber?.user.firstName} ${barber?.user.lastName}`,
          branchId,
          points: pointsToUse,
          discount: validPromoCode ? validPromoCode.discount : 0,
          type: validPromoCode ? validPromoCode.type : 'AMOUNT',
          usedPackage: allServices
            .filter((s) => s.isFree)
            .map((s) => s.id),
          freeService: allServices.filter((s) => s.isFree).map((s) => s.id),
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
      promoCode: promoCode ?? null,
      subTotal: order.subTotal?.toString(),
      discount: this.orderShared.buildDiscountDisplay(
        validPromoCode,
        pointsDiscount,
        discount,
      ),
      total: order.total?.toString(),
    };
  }
}
