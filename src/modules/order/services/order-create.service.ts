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
import { Language, PromoCode } from '@prisma/client';
import { format } from 'date-fns';
import {
  OrderSharedService,
  ServiceWithFreeFlag,
} from './order-shared.service';

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

    this.validateInput(points);

    const dateWithoutTime = createOrderDto.date.toString().split('T')[0];
    const resolvedUserId = await this.orderShared.resolveUserId(phone, userId);
    const { fetchedServices, totalDuration } =
      await this.orderShared.fetchServices(service);

    const {
      existingOrder,
      usedPromoCode,
      slots,
      validPromoCode,
      user,
      settings,
    } = await this.fetchParallelData(
      barberId,
      dateWithoutTime,
      slot,
      resolvedUserId,
      promoCode,
      totalDuration,
    );

    this.validateRules({
      user,
      existingOrder,
      slots,
      slot,
      barberId,
      usedPromoCode,
      promoCode,
      settings,
      dateWithoutTime,
    });

    const { barber } = await this.fetchBarberAndBranch(barberId, branchId);
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

    const pointsToUse = this.resolvePointsToUse(points, user);

    const orderData = {
      rest,
      slot,
      userId: resolvedUserId,
      barberId,
      barber,
      barberName,
      branchId,
      pointsToUse,
      allServices,
      dateWithoutTime,
      subTotal,
      total,
      validPromoCode,
      promoCode,
      usedPackage,
    };
    const order =
      user.role === 'USER'
        ? await this.createUserOrder(orderData)
        : await this.createStaffOrder(orderData);

    if (pointsToUse > 0) {
      await this.deductPoints(resolvedUserId, pointsToUse);
    }

    return this.buildResponse(
      order,
      allServices,
      lang,
      barberId,
      pointsDiscount,
      discount,
      validPromoCode,
      promoCode,
    );
  }

  private validateInput(points: number | undefined | null) {
    if (points !== undefined && points !== null && !Number.isInteger(points))
      throw new BadRequestException('Points must be a number');
    if (points && points < 1000)
      throw new BadRequestException('Minimum points required is 1000');
  }

  private async fetchParallelData(
    barberId: string | undefined,
    dateWithoutTime: string,
    slot: string,
    userId: string,
    promoCode: string | undefined,
    totalDuration: number,
  ) {
    const [
      existingOrder,
      usedPromoCode,
      slots,
      validPromoCode,
      user,
      settings,
    ] = await Promise.all([
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
      this.orderShared.fetchSlots(barberId, dateWithoutTime, totalDuration),
      this.orderShared.validatePromoCode(promoCode),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          client: { select: { points: true, ban: true } },
          role: true,
        },
      }),
      this.prisma.settings.findFirst({}),
    ]);

    return {
      existingOrder,
      usedPromoCode,
      slots,
      validPromoCode,
      user,
      settings,
    };
  }

  private validateRules(data: {
    user: { client?: { points?: number; ban: boolean }; role: string };
    existingOrder: unknown;
    slots: string[];
    slot: string;
    barberId: string | undefined;
    usedPromoCode: { UserOrders: unknown[] } | null;
    promoCode: string | undefined;
    settings: { maxDaysBooking: number };
    dateWithoutTime: string;
  }) {
    if (!data.user) throw new NotFoundException('User not found');
    if (data.user.client?.ban) throw new BadRequestException('You are banned');
    if (!data.settings) throw new NotFoundException('Settings not found');

    const diffInDays =
      (new Date(data.dateWithoutTime).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffInDays > data.settings.maxDaysBooking)
      throw new ConflictException(
        `You can only book up to ${data.settings.maxDaysBooking} days in advance`,
      );
    if (data.usedPromoCode?.UserOrders.length && data.promoCode)
      throw new ConflictException(
        `Promo code "${data.promoCode}" is invalid or expired.`,
      );
    if (data.existingOrder)
      throw new ConflictException(`Slot ${data.slot} is already booked`);
    if (data.barberId && !data.slots.includes(data.slot))
      throw new ServiceUnavailableException(`Slot ${data.slot} is Unavailable`);
  }

  private async fetchBarberAndBranch(
    barberId: string | undefined,
    branchId: string,
  ) {
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

    return { barber, branch };
  }

  private resolvePointsToUse(
    points: number | undefined,
    user: { client?: { points?: number } },
  ): number {
    if (!points) return 0;
    if (points > (user.client?.points ?? 0))
      throw new BadRequestException('You do not have enough points');
    return points;
  }

  private async createUserOrder(data: {
    rest: object;
    slot: string;
    userId: string;
    barberId: string | undefined;
    barber: { user: { firstName: string; lastName: string } } | null;
    branchId: string;
    pointsToUse: number;
    allServices: ServiceWithFreeFlag[];
    dateWithoutTime: string;
    subTotal: number;
    total: number;
    validPromoCode: PromoCode | null | false;
    promoCode: string | undefined;
    usedPackage: string[] | undefined;
  }) {
    const order = await this.prisma.order.create({
      data: {
        ...data.rest,
        ...(data.validPromoCode && { promoCode: data.promoCode }),
        slot: data.slot,
        userId: data.userId,
        ...(data.barberId && { barberId: data.barberId }),
        barberName: `${data.barber?.user.firstName} ${data.barber?.user.lastName}`,
        branchId: data.branchId,
        points: data.pointsToUse,
        usedPackage: data.allServices.filter((s) => s.isFree).map((s) => s.id),
        date: new Date(data.dateWithoutTime),
        service: { connect: data.allServices.map((s) => ({ id: s.id })) },
        subTotal: data.subTotal,
        total: data.total,
      },
      include: {
        service: { include: { PackagesServices: { select: { id: true } } } },
      },
    });

    await this.applyPackageSideEffects(order, data.usedPackage);
    return order;
  }

  private async applyPackageSideEffects(
    order: {
      userId: string;
      service: { PackagesServices: { id: string }[] }[];
    },
    usedPackage: string[] | undefined,
  ) {
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

      if (packageService.length > 0) {
        await prisma.packagesServices.updateMany({
          where: {
            id: { in: packageService.map((ps) => ps.id) },
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
  }

  private async deductPoints(userId: string, pointsToUse: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { client: { update: { points: { decrement: pointsToUse } } } },
    });
  }

  private async createStaffOrder(data: {
    rest: object;
    slot: string;
    userId: string;
    barberId: string | undefined;
    barber: { user: { firstName: string; lastName: string } } | null;
    barberName: string | undefined;
    branchId: string;
    pointsToUse: number;
    allServices: ServiceWithFreeFlag[];
    dateWithoutTime: string;
    subTotal: number;
    total: number;
    validPromoCode: PromoCode | null | false;
    promoCode: string | undefined;
  }) {
    return this.prisma.order.create({
      data: {
        ...data.rest,
        ...(data.validPromoCode && { promoCode: data.promoCode }),
        slot: data.slot,
        userId: data.userId,
        barberId: data.barberId,
        barberName:
          data.barberName ||
          `${data.barber?.user.firstName} ${data.barber?.user.lastName}`,
        branchId: data.branchId,
        points: data.pointsToUse,
        discount: data.validPromoCode ? data.validPromoCode.discount : 0,
        type: data.validPromoCode ? data.validPromoCode.type : 'AMOUNT',
        usedPackage: data.allServices.filter((s) => s.isFree).map((s) => s.id),
        freeService: data.allServices.filter((s) => s.isFree).map((s) => s.id),
        date: new Date(data.dateWithoutTime),
        service: { connect: data.allServices.map((s) => ({ id: s.id })) },
        subTotal: data.subTotal,
        total: data.total,
      },
      include: {
        service: { include: { PackagesServices: { select: { id: true } } } },
      },
    });
  }

  private buildResponse(
    order: {
      date: Date;
      slot: string;
      barberId?: string;
      branchId: string;
      barberName: string;
      points?: number;
      createdAt: Date;
      subTotal?: number;
      total?: number;
    },
    allServices: ServiceWithFreeFlag[],
    lang: Language,
    barberId: string | undefined,
    pointsDiscount: number,
    discount: number,
    validPromoCode: PromoCode | null | false,
    promoCode: string | undefined,
  ) {
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
