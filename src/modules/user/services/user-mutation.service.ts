import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, OrderStatus, Role } from '@prisma/client';
import { addDays } from 'date-fns';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthSlotService } from '../../auth/services/auth-slot.service';
import { UserQueryService } from './user-query.service';
import { UserUpdateDto } from '../dto/user-update-dto';

@Injectable()
export class UserMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSlot: AuthSlotService,
    private readonly userQuery: UserQueryService,
  ) {}

  private async getLatestOrderDate(barberId: string): Promise<Date | null> {
    const latestOrder = await this.prisma.order.findFirst({
      where: {
        barberId,
        booking: { in: ['UPCOMING'] },
        status: {
          not: {
            in: [
              OrderStatus.ADMIN_CANCELLED,
              OrderStatus.CLIENT_CANCELLED,
              OrderStatus.BARBER_CANCELLED,
              OrderStatus.CASHIER_CANCELLED,
            ],
          },
        },
        deleted: false,
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    return latestOrder?.date ?? null;
  }

  public async updateUser(
    id: string,
    dto: UserUpdateDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.userQuery.findOne(id);
    const { vacations, vacationsToDelete, type, start, end, ...rest } = dto;
    const roleKey =
      user.role === Role.USER ? 'client' : user.role.toLowerCase();
    const avatar = file?.path;

    let effectiveSlotDate: Date | null = null;
    let shouldUpdateImmediately = true;

    if (user.role === Role.BARBER && (start || end)) {
      const barberSlot = await this.prisma.slot.findFirst({
        where: { barberId: user.id },
        select: { slot: true },
      });

      const isSlotEmpty =
        !barberSlot || !barberSlot.slot || barberSlot.slot.length === 0;

      if (!isSlotEmpty) {
        const latestOrderDate = await this.getLatestOrderDate(user.id);

        if (latestOrderDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const latestOrderDateOnly = new Date(latestOrderDate);
          latestOrderDateOnly.setHours(0, 0, 0, 0);

          if (latestOrderDateOnly < today) {
            shouldUpdateImmediately = true;
            effectiveSlotDate = null;
          } else {
            effectiveSlotDate = addDays(latestOrderDateOnly, 1);
            shouldUpdateImmediately = false;
          }
        }
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(avatar && { avatar }),
        ...((vacations || vacationsToDelete || start || end || type) &&
          user.role !== Role.USER && {
            [roleKey]: {
              update: {
                ...((vacationsToDelete || vacations) && {
                  vacations: {
                    ...(vacationsToDelete && {
                      deleteMany: { id: { in: vacationsToDelete } },
                    }),
                    ...(vacations && {
                      upsert: vacations.map((vacation) => ({
                        where: { id: vacation.id || 'new' },
                        create: {
                          dates: vacation.dates.map(
                            (v) => new Date(v.split('T')[0]),
                          ),
                          month: new Date(vacation.month),
                        },
                        update: {
                          dates: vacation.dates.map(
                            (v) => new Date(v.split('T')[0]),
                          ),
                          month: new Date(vacation.month),
                        },
                      })),
                    }),
                  },
                }),
                ...((start || end) && {
                  Slot: {
                    update: shouldUpdateImmediately
                      ? {
                          data: {
                            slot: await this.authSlot.generateSlots(start, end),
                            effectiveSlotDate: null,
                            updatedSlot: [],
                            end,
                            start,
                          },
                        }
                      : {
                          data: {
                            updatedSlot: await this.authSlot.generateSlots(
                              start,
                              end,
                            ),
                            effectiveSlotDate,
                            end,
                            start,
                          },
                        },
                  },
                }),
                ...(user.role === Role.BARBER && { type }),
              },
            },
          }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phone: true,
        ...(user.role === Role.BARBER && {
          barber: { include: { vacations: true, Slot: true } },
        }),
        ...(user.role === Role.CASHIER && {
          cashier: { include: { vacations: true, Slot: true } },
        }),
        ...(user.role === Role.USER && {
          client: {
            select: {
              referralCode: true,
              points: true,
              ban: true,
              canceledOrders: true,
            },
          },
        }),
        ...(user.role === Role.ADMIN && { admin: true }),
      },
    });

    return updatedUser;
  }

  public async updateBarberAvailability(id: string) {
    const existing = await this.prisma.barber.findUnique({
      where: { id },
      select: { isAvailable: true },
    });

    if (!existing) throw new NotFoundException('Barber not found');

    return this.prisma.barber.update({
      where: { id },
      data: { isAvailable: !existing.isAvailable },
    });
  }

  public async unbanUser(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { phone },
      data: { client: { update: { ban: false, canceledOrders: 0 } } },
    });
  }

  public async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const deleted = await this.prisma.user.update({
      where: { id: userId },
      data: {
        deleted: true,
        UserOrders: {
          updateMany: {
            where: {
              AND: [
                { userId },
                {
                  OR: [
                    { booking: BookingStatus.UPCOMING },
                    { status: OrderStatus.IN_PROGRESS },
                    { status: OrderStatus.PENDING },
                  ],
                },
              ],
            },
            data: {
              deleted: true,
              booking: BookingStatus.CANCELLED,
              status: OrderStatus.CLIENT_CANCELLED,
            },
          },
        },
      },
    });

    return deleted;
  }

  public async deleteEmployee(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { BarberOrders: true, CashierOrders: true },
    });

    if (!user) throw new NotFoundException('Employee not found');

    switch (user.role) {
      case Role.BARBER:
        if (user.BarberOrders.length > 0) {
          await this.prisma.order.updateMany({
            where: { barberId: id },
            data: {
              barberId: null,
              barberName: `${user.firstName} ${user.lastName}`,
            },
          });
        }
        await this.prisma.barber.delete({ where: { id } });
        await this.prisma.user.delete({ where: { id } });
        break;

      case Role.CASHIER:
        if (user.CashierOrders.length > 0) {
          await this.prisma.order.updateMany({
            where: { cashierId: id },
            data: { cashierId: null },
          });
        }
        await this.prisma.cashier.delete({ where: { id } });
        await this.prisma.user.delete({ where: { id } });
        break;
    }

    return null;
  }
}
