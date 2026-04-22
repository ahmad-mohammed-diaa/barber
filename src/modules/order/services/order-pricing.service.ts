import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import { Language, OrderStatus, BookingStatus } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class OrderPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  getOrderById(id: string) {
    return this.orderQuery.findOneOrFail(id);
  }

  async getNonSelectedServices(id: string, language: Language) {
    const order = await this.orderQuery.findOneOrFail(id);

    const FetchedCategory = await this.prisma.category.findMany({
      include: {
        Translation: true,
        services: {
          where: { id: { notIn: order.service.flatMap((o) => o.id) } },
          include: { Translation: true },
        },
      },
    });

    const category = FetchedCategory.map((category) => {
      const { Translation, services, ...rest } = category;
      return {
        ...rest,
        nameEN: Translation.find((t) => t.language === 'EN')?.name,
        nameAR: Translation.find((t) => t.language === 'AR')?.name,
        name: Translation.find((t) => t.language === language)?.name,
        services: services.map((service) => {
          const { Translation, ...rest } = service;
          return {
            ...rest,
            nameEN: Translation.find((t) => t.language === 'EN')?.name,
            nameAR: Translation.find((t) => t.language === 'AR')?.name,
            name: Translation.find((t) => t.language === language)?.name,
          };
        }),
      };
    });

    return { category };
  }

  async evaluateOrder(
    id: string,
    query?: { discount?: number; points?: number },
  ) {
    const { discount, points } = query ?? {};

    const [currentOrder, settings] = await Promise.all([
      this.prisma.order.findUnique({
        where: {
          id,
          NOT: {
            OR: [
              { status: OrderStatus.PAID },
              {
                status: {
                  in: [
                    OrderStatus.ADMIN_CANCELLED,
                    OrderStatus.CLIENT_CANCELLED,
                    OrderStatus.BARBER_CANCELLED,
                    OrderStatus.CASHIER_CANCELLED,
                  ],
                },
              },
            ],
          },
        },
        select: { subTotal: true, total: true, userId: true },
      }),
      this.prisma.settings.findFirst(),
    ]);

    if (!currentOrder)
      throw new ConflictException('Order is either PAID or cancelled');

    const orderClient = currentOrder.userId
      ? await this.prisma.client.findUnique({
          where: { id: currentOrder.userId },
        })
      : null;

    let total = currentOrder.total;
    let pointsDiscount = 0;
    let discountAmount = 0;

    if (points) {
      if (!settings) throw new NotFoundException('Settings not found');
      pointsDiscount = this.orderQuery.validatePoints(
        total,
        points,
        orderClient?.points ?? 0,
        settings.pointLimit,
      );
      total = total - pointsDiscount;
    }

    if (discount) {
      if (discount < 0)
        throw new BadRequestException('Discount cannot be negative');
      if (discount > 100)
        throw new BadRequestException('Discount cannot be greater than 100%');
      discountAmount = (total * discount) / 100;
      total = total - discountAmount;
    }

    return {
      subTotal: currentOrder.subTotal,
      pointsDiscount,
      discountAmount,
      total: Math.max(total, 0),
    };
  }

  async getSlots(date: string, barberId?: string, totalDuration?: number) {
    const EGYPT_TIMEZONE = 'Africa/Cairo';

    let dateWithoutTime: string;
    if (date.includes('T')) dateWithoutTime = date.split('T')[0];
    else if (date.includes(' ')) dateWithoutTime = date.split(' ')[0];
    else dateWithoutTime = date;

    const startOfDay = new Date(`${dateWithoutTime}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateWithoutTime}T23:59:59.999Z`);
    const vacationCheckDate = new Date(dateWithoutTime);

    if (
      isNaN(vacationCheckDate.getTime()) ||
      isNaN(startOfDay.getTime()) ||
      isNaN(endOfDay.getTime())
    ) {
      return { slots: [] };
    }

    if (!barberId) return { slots: [] };

    const barber = await this.prisma.barber.findUnique({
      where: {
        id: barberId,
        OR: [
          {
            NOT: {
              vacations: { some: { dates: { hasSome: [vacationCheckDate] } } },
            },
          },
        ],
      },
    });

    if (!barber) return { slots: [] };

    const [orders, allSlotsData, settings] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          barberId,
          date: { gte: startOfDay, lte: endOfDay },
          deleted: false,
          booking: { in: [BookingStatus.UPCOMING] },
          status: {
            notIn: [
              OrderStatus.ADMIN_CANCELLED,
              OrderStatus.CLIENT_CANCELLED,
              OrderStatus.BARBER_CANCELLED,
              OrderStatus.CASHIER_CANCELLED,
            ],
          },
        },
        select: {
          id: true,
          date: true,
          slot: true,
          booking: true,
          status: true,
          service: { select: { duration: true } },
        },
      }),
      this.prisma.barber.findUnique({
        where: { id: barberId },
        select: {
          Slot: {
            select: { slot: true, updatedSlot: true, effectiveSlotDate: true },
          },
        },
      }),
      this.prisma.settings.findFirst({ select: { slotDuration: true } }),
    ]);

    if (!allSlotsData)
      throw new ConflictException('No slots found in the database.');
    if (!allSlotsData.Slot) return { slots: [] };

    const todayInEgypt = toZonedTime(new Date(), EGYPT_TIMEZONE)
      .toISOString()
      .split('T')[0];
    const { effectiveSlotDate, updatedSlot, slot } = allSlotsData.Slot;
    const effectiveSlotDateWithoutTime = effectiveSlotDate
      ? toZonedTime(effectiveSlotDate, EGYPT_TIMEZONE)
          .toISOString()
          .split('T')[0]
      : null;

    let allSlots: string[] = slot || [];

    if (!slot || slot.length === 0) return { slots: [] };

    if (
      effectiveSlotDateWithoutTime &&
      dateWithoutTime >= effectiveSlotDateWithoutTime &&
      updatedSlot &&
      updatedSlot.length > 0
    ) {
      allSlots = updatedSlot;
    }

    if (
      effectiveSlotDateWithoutTime &&
      todayInEgypt >= effectiveSlotDateWithoutTime
    ) {
      if (updatedSlot && updatedSlot.length > 0) {
        const newSlots = await this.prisma.slot.update({
          where: { barberId },
          data: { slot: updatedSlot, effectiveSlotDate: null, updatedSlot: [] },
        });
        allSlots = newSlots.slot;
      } else {
        await this.prisma.slot.update({
          where: { barberId },
          data: { effectiveSlotDate: null, updatedSlot: [] },
        });
      }
    }

    const blockedSlots = [];
    const slotDurationMinutes = settings?.slotDuration || 15;

    for (const order of orders) {
      const startIndex = allSlots.indexOf(order.slot);
      if (startIndex === -1) continue;
      const totalDurationMinutes = order.service.reduce(
        (sum, s) => sum + s.duration,
        0,
      );
      const slotsNeeded = Math.ceil(totalDurationMinutes / slotDurationMinutes);
      allSlots
        .slice(startIndex, startIndex + slotsNeeded)
        .forEach((slot) => blockedSlots.push(slot));
    }

    let availableSlots = allSlots.filter(
      (slot) => !blockedSlots.includes(slot),
    );

    const currentTimeInEgypt = toZonedTime(new Date(), EGYPT_TIMEZONE);
    const todayDate = currentTimeInEgypt.toISOString().split('T')[0];
    const currentHour = currentTimeInEgypt.getHours();
    const currentMinute = currentTimeInEgypt.getMinutes();

    if (dateWithoutTime === todayDate) {
      availableSlots = availableSlots.filter((slot) => {
        const slotTime = this.parseSlotTime(slot);
        if (!slotTime) return true;
        return (
          slotTime.hour * 60 + slotTime.minute >
          currentHour * 60 + currentMinute
        );
      });
    }

    if (totalDuration && totalDuration > settings.slotDuration) {
      const durationInSlots = Math.ceil(totalDuration / slotDurationMinutes);
      const validStartSlots = availableSlots.filter((slot) => {
        const startIndex = allSlots.indexOf(slot);
        if (startIndex === -1) return false;
        for (let i = 0; i < durationInSlots; i++) {
          const requiredSlotIndex = startIndex + i;
          if (requiredSlotIndex >= allSlots.length) return false;
          const requiredSlot = allSlots[requiredSlotIndex];
          if (!requiredSlot || !availableSlots.includes(requiredSlot))
            return false;
        }
        return true;
      });
      if (validStartSlots.length === 0) return { slots: [] };
      availableSlots = validStartSlots;
    }

    return { slots: availableSlots };
  }

  private parseSlotTime(slot: string): { hour: number; minute: number } | null {
    try {
      const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const match = slot.match(timeRegex);
      if (!match) return null;
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const period = match[3].toUpperCase();
      if (period === 'AM') {
        if (hour === 12) hour = 0;
      } else {
        if (hour !== 12) hour += 12;
      }
      return { hour, minute };
    } catch {
      return null;
    }
  }
}
