import {
  BadRequestException,
  ConflictException,
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
import { Language, PromoCode, Service } from '@prisma/client';
import { format } from 'date-fns';

interface ServiceWithFreeFlag extends Service {
  isFree: boolean;
}

interface PricingResult {
  subTotal: number;
  pointsDiscount: number;
  discount: number;
  total: number;
}

@Injectable()
export class OrderReviewService {
  private readonly logger = new Logger(OrderReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promoCodeService: PromoCodeService,
    private readonly orderQuery: OrderQueryService,
    private readonly orderPricing: OrderPricingService,
  ) {}

  async execute(dto: CreateOrderDto, userId: string, lang: Language) {
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
    } = dto;

    try {
      if (points && points <= 0)
        throw new BadRequestException('You have exceeded the points limit');

      const dateWithoutTime = date.toString().split('T')[0];

      const resolvedUserId = await this.resolveUserId(phone, userId);
      const { fetchedServices, totalDuration } =
        await this.fetchServices(service);
      const { order, usedPromoCode, slots, validPromoCode, user } =
        await this.fetchParallelData(
          barberId,
          dateWithoutTime,
          slot,
          resolvedUserId,
          promoCode,
          totalDuration,
        );

      const settings = await this.prisma.settings.findFirst({});
      if (!settings) throw new NotFoundException('Settings not found');

      this.validateRules(dto, order, slots, usedPromoCode, user, settings);

      const { allServices, costServices } = await this.resolveServiceList(
        resolvedUserId,
        user?.role,
        fetchedServices,
        usedPackage,
      );

      const pricing = this.calculatePricing(
        costServices,
        points,
        usedPromoCode,
        validPromoCode,
      );

      const now = new Date();
      const diffInDays =
        (new Date(dateWithoutTime).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24);
      if (diffInDays >= settings.maxDaysBooking)
        throw new BadRequestException(
          `You can only book up to ${settings.maxDaysBooking} days in advance`,
        );

      return this.buildResponse(
        dateWithoutTime,
        slot,
        barberId,
        branchId,
        phone,
        lang,
        allServices,
        pricing,
        validPromoCode,
        promoCode,
        user,
        settings,
        usedPromoCode,
        points,
      );
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

  private async resolveUserId(
    phone: string | undefined,
    userId: string,
  ): Promise<string> {
    if (!phone || phone === '') return userId;
    const another = await this.prisma.user.findUnique({ where: { phone } });
    return another ? another.id : userId;
  }

  private async fetchServices(serviceIds: string[]) {
    const fetchedServices = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });
    const totalDuration = fetchedServices.reduce(
      (acc, s) => acc + s.duration,
      0,
    );
    return { fetchedServices, totalDuration };
  }

  private async fetchParallelData(
    barberId: string | undefined,
    dateWithoutTime: string,
    slot: string,
    userId: string,
    promoCode: string | undefined,
    totalDuration: number,
  ) {
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

    return { order, usedPromoCode, slots, validPromoCode, user };
  }

  private validateRules(
    dto: CreateOrderDto,
    order: unknown,
    slots: string[],
    usedPromoCode: { UserOrders: unknown[] } | null,
    user: unknown,
    settings: { pointLimit: number },
  ) {
    if (dto.phone && !user) throw new NotFoundException('User not found');
    if (dto.points && dto.points <= 0 && settings.pointLimit > dto.points)
      throw new BadRequestException('You have exceeded the points limit');
    if (usedPromoCode && usedPromoCode.UserOrders.length && dto.promoCode)
      throw new ConflictException(
        `Promo code "${dto.promoCode}" is invalid or expired.`,
      );
    if (order)
      throw new ConflictException(`Slot ${dto.slot} is already booked`);
    if (dto.barberId && !slots.includes(dto.slot))
      throw new ServiceUnavailableException(`Slot ${dto.slot} is Unavailable`);
  }

  private async resolveServiceList(
    userId: string,
    role: string | undefined,
    fetchedServices: Service[],
    usedPackage: string[] | undefined,
  ): Promise<{
    allServices: ServiceWithFreeFlag[];
    costServices: ServiceWithFreeFlag[];
  }> {
    const allServices: ServiceWithFreeFlag[] = [];

    if (role === 'USER') {
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

      if (clientPackages.length === 0) {
        allServices.push(
          ...fetchedServices.map((srv) => ({ ...srv, isFree: false })),
        );
      } else {
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

        allServices.push(
          ...fetchedServices.map((srv) => ({
            ...srv,
            isFree: single.some((s) => s.id === srv.id),
          })),
        );

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
      }
    } else {
      allServices.push(
        ...fetchedServices.map((srv) => ({ ...srv, isFree: false })),
      );
    }

    const costServices = allServices.filter((s) => !s.isFree);
    return { allServices, costServices };
  }

  private calculatePricing(
    costServices: ServiceWithFreeFlag[],
    points: number | undefined,
    usedPromoCode: { client?: { points?: number } } | null,
    validPromoCode: PromoCode | null | false,
  ): PricingResult {
    const subTotal = costServices.reduce((acc, s) => acc + s.price, 0);

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
    return { subTotal, pointsDiscount, discount, total };
  }

  private buildDiscountDisplay(
    validPromoCode: PromoCode | null | false,
    pointsDiscount: number,
    discount: number,
  ): string {
    if (validPromoCode && pointsDiscount > 0) {
      return validPromoCode.type === 'PERCENTAGE'
        ? `${validPromoCode.discount}% + ${pointsDiscount}EGP`
        : `${discount}EGP + ${pointsDiscount}EGP`;
    }
    if (validPromoCode) {
      return validPromoCode.type === 'PERCENTAGE'
        ? `${validPromoCode.discount}%`
        : `${validPromoCode.discount}EGP`;
    }
    return pointsDiscount > 0 ? `${pointsDiscount}EGP` : '0';
  }

  private buildResponse(
    dateWithoutTime: string,
    slot: string,
    barberId: string | undefined,
    branchId: string,
    phone: string | undefined,
    lang: Language,
    allServices: ServiceWithFreeFlag[],
    pricing: PricingResult,
    validPromoCode: PromoCode | null | false,
    promoCode: string | undefined,
    user: {
      client?: {
        user?: { firstName?: string; lastName?: string; phone?: string };
      };
    } | null,
    settings: { pointLimit: number },
    usedPromoCode: { client?: { points?: number } } | null,
    points: number | undefined,
  ) {
    const { subTotal, pointsDiscount, discount, total } = pricing;
    const duration = allServices.reduce((acc, s) => acc + s.duration, 0);
    const discountDisplay = this.buildDiscountDisplay(
      validPromoCode,
      pointsDiscount,
      discount,
    );

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
      promoCode: promoCode ?? null,
      subTotal: subTotal?.toString(),
      discount: discountDisplay,
      pointsDiscount: pointsDiscount.toString(),
      total: total.toString(),
      limit: settings.pointLimit.toString(),
    };
  }
}
