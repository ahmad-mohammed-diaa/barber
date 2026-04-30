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
import { PromoCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Language } from '@prisma/client';
import { format } from 'date-fns';
import {
  OrderSharedService,
  PricingResult,
  ServiceWithFreeFlag,
} from './order-shared.service';

@Injectable()
export class OrderReviewService {
  private readonly logger = new Logger(OrderReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderShared: OrderSharedService,
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

      const resolvedUserId = await this.orderShared.resolveUserId(phone, userId);
      const { fetchedServices, totalDuration } =
        await this.orderShared.fetchServices(service);

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
            where: { id: resolvedUserId },
            select: {
              client: { select: { points: true } },
              UserOrders: { where: { promoCode, status: 'PENDING' } },
            },
          }),
          this.orderShared.fetchSlots(barberId, dateWithoutTime, totalDuration),
          this.orderShared.validatePromoCode(promoCode),
          this.prisma.user.findUnique({
            where: { id: resolvedUserId },
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

      const settings = await this.prisma.settings.findFirst({});
      if (!settings) throw new NotFoundException('Settings not found');

      this.validateRules(dto, order, slots, usedPromoCode, user, settings);

      const { allServices, costServices } =
        await this.orderShared.resolveServiceList(
          resolvedUserId,
          user?.role,
          fetchedServices,
          usedPackage,
        );

      const pricing = this.orderShared.calculatePricing(
        costServices,
        points,
        usedPromoCode,
        validPromoCode,
      );

      const diffInDays =
        (new Date(dateWithoutTime).getTime() - new Date().getTime()) /
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
    user: { client?: { user?: { firstName?: string; lastName?: string; phone?: string } } } | null,
    settings: { pointLimit: number },
    usedPromoCode: { client?: { points?: number } } | null,
    points: number | undefined,
  ) {
    const { subTotal, pointsDiscount, discount, total } = pricing;
    const duration = allServices.reduce((acc, s) => acc + s.duration, 0);

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
      discount: this.orderShared.buildDiscountDisplay(
        validPromoCode,
        pointsDiscount,
        discount,
      ),
      pointsDiscount: pointsDiscount.toString(),
      total: total.toString(),
      limit: settings.pointLimit.toString(),
    };
  }
}
