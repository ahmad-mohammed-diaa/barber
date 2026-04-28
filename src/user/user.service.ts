import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, OrderStatus, Prisma, Role, User } from '@prisma/client';
import { UserUpdateDto } from './dto/user-update-dto';
import { AppSuccess } from 'src/utils/AppSuccess';
import { AuthService } from 'src/auth/auth.service';
import { addDays } from 'date-fns';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly AuthService: AuthService,
  ) {}

  private user = {
    id: true,
    firstName: true,
    lastName: true,
    avatar: true,
    phone: true,
    role: true,
    fcmToken: true,
    createdAt: true,
    updatedAt: true,
  } as Prisma.UserSelect;

  private client = {
    id: false,
    referralCode: true,
    points: true,
    ban: true,
    canceledOrders: true,
  } as Prisma.ClientSelect;

  private barber = {
    id: false,
    branch: true,
    Slot: {
      select: {
        id: true,
        start: true,
        end: true,
        slot: true,
        updatedSlot: true,
        effectiveSlotDate: true,
      },
    },
    rate: true,
    type: true,
    vacations: true,
    isAvailable: true,
  } as Prisma.BarberSelect;

  private cashier = {
    id: false,
    branch: true,
    Slot: {
      select: {
        id: true,
        start: true,
        end: true,
        slot: true,
        updatedSlot: true,
        effectiveSlotDate: true,
      },
    },
    vacations: true,
  } as Prisma.CashierSelect;

  public async findAllClients(page = 1, pageSize = 10, phone?: string) {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          role: Role.USER,
          ...(phone && { phone }),
        },
        select: {
          ...this.user,
          client: { select: this.client },
        },
        skip: (page - 1) * pageSize,
        take: +pageSize,
      });

      return new AppSuccess({ users }, 'Clients fetched successfully', 200);
    } catch (error) {
      console.error('Error fetching clients:', error.message);
      throw error;
    }
  }

  public async findAllUser(page = 1, pageSize = 10, role?: Role) {
    if (role && !Role[role?.toUpperCase()]) {
      throw new NotFoundException('Role not found');
    }

    try {
      const include = role
        ? {
            [role?.toLowerCase()]: {
              select:
                Role[role.toUpperCase()] === 'ADMIN'
                  ? ({ id: true } as Prisma.AdminSelect)
                  : Role[role.toUpperCase()] === 'BARBER'
                    ? this.barber
                    : Role[role.toUpperCase()] === 'CASHIER'
                      ? this.cashier
                      : this.client,
            },
          }
        : {
            admin: false,
            barber: { select: this.barber },
            cashier: { select: this.cashier },
          };
      const fetchedUser = await this.prisma.user.findMany({
        where: { role: Role[role?.toUpperCase()] ?? { not: Role.USER } },
        skip: (page - 1) * pageSize,
        take: +pageSize,
        select: { ...this.user, ...include },
      });

      const users = fetchedUser.map(({ barber, cashier, ...user }) => {
        const processSlotInfo = (employeeData: any) => {
          if (!employeeData || !employeeData.Slot) return employeeData;

          const { Slot, ...rest } = employeeData;
          const today = new Date().toISOString().split('T')[0];

          return {
            ...rest,
            schedule: {
              workingHours: {
                start: Slot.start,
                end: Slot.end,
              },
              currentSlots: Slot.slot || [],
              ...(Slot.updatedSlot &&
                Slot.updatedSlot.length > 0 && {
                  newSlots: Slot.updatedSlot,
                  effectiveDate: Slot.effectiveSlotDate
                    ?.toISOString()
                    .split('T')[0],
                  isNewSlotActive: Slot.effectiveSlotDate
                    ? today >=
                      Slot.effectiveSlotDate.toISOString().split('T')[0]
                    : false,
                }),
            },
          };
        };

        return {
          ...user,
          ...(barber && { barber: processSlotInfo(barber) }),
          ...(cashier && { cashier: processSlotInfo(cashier) }),
        };
      });

      return new AppSuccess({ users }, 'Users fetched successfully', 200);
    } catch (error) {
      console.error('Error fetching users:', error.message);
      throw error;
    }
  }

  public async findOneUser(id: string) {
    const user = await this.findOne(id);

    if (!user) throw new NotFoundException('User not found');

    return new AppSuccess(user, 'User fetched successfully', 200);
  }

  public async updateUser(
    id: string,
    userData: UserUpdateDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    const {
      vacations,
      vacationsToDelete,
      type,
      start,
      end,
      isAvailable,
      ...rest
    } = userData;
    const roleKey =
      user.role === Role.USER ? 'client' : user.role.toLowerCase();
    const avatar = file?.path;

    // For barbers updating their slots, check if they have future orders
    let effectiveSlotDate: Date | null = null;
    let shouldUpdateImmediately = true;

    if (user.role === Role.BARBER && (start || end)) {
      // Check if barber's current slot is empty
      const barberSlot = await this.prisma.slot.findFirst({
        where: { barberId: user.id },
        select: { slot: true },
      });

      const isSlotEmpty =
        !barberSlot || !barberSlot.slot || barberSlot.slot.length === 0;

      if (isSlotEmpty) {
        // Slot is empty, update immediately
        shouldUpdateImmediately = true;
        effectiveSlotDate = null;
      } else {
        const latestOrderDate = await this.getLatestOrderDate(user.id);

        if (latestOrderDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

          const latestOrderDateOnly = new Date(latestOrderDate);
          latestOrderDateOnly.setHours(0, 0, 0, 0);

          // If last order day < today, update immediately
          if (latestOrderDateOnly < today) {
            shouldUpdateImmediately = true;
            effectiveSlotDate = null;
          } else {
            // Set effective slot date to the day after the last order
            effectiveSlotDate = addDays(latestOrderDateOnly, 1); // Use latestOrderDateOnly instead of latestOrderDate
            shouldUpdateImmediately = false;
          }
        } else {
          // No future orders, update immediately
          shouldUpdateImmediately = true;
          effectiveSlotDate = null;
        }
      }
    }

    const updateUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(avatar && { avatar }),
        ...((vacations ||
          vacationsToDelete ||
          start ||
          end ||
          type ||
          isAvailable !== undefined) &&
          user.role !== Role.USER && {
            [roleKey]: {
              update: {
                ...((vacationsToDelete || vacations) && {
                  vacations: {
                    ...(vacationsToDelete && {
                      deleteMany: {
                        id: { in: vacationsToDelete },
                      },
                    }),
                    ...(vacations && {
                      upsert: vacations.map((vacation) => ({
                        where: { id: vacation.id || 'new' },
                        create: {
                          dates: (Array.isArray(vacation.dates)
                            ? vacation.dates
                            : [vacation.dates]
                          ).map((v) => {
                            const dateWithoutTime = v.split('T')[0];
                            return new Date(dateWithoutTime);
                          }),
                          month: new Date(vacation.month),
                        },
                        update: {
                          dates: (Array.isArray(vacation.dates)
                            ? vacation.dates
                            : [vacation.dates]
                          ).map((v) => {
                            const dateWithoutTime = v.split('T')[0];
                            return new Date(dateWithoutTime);
                          }),
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
                            slot: await this.AuthService.generateSlots(
                              start,
                              end,
                            ),
                            effectiveSlotDate: null,
                            updatedSlot: [],
                            end,
                            start,
                          },
                        }
                      : {
                          data: {
                            updatedSlot: await this.AuthService.generateSlots(
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
                ...(user.role === Role.BARBER &&
                  isAvailable !== undefined && { isAvailable }),
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
          client: { select: this.client },
        }),
        ...(user.role === Role.ADMIN && {
          admin: true,
        }),
      },
    });
    console.log(updateUser);

    return new AppSuccess(updateUser, 'User updated successfully', 200);
  }

  // public async updateUser(
  //   id: string,
  //   userData: UserUpdateDto,
  //   file?: Express.Multer.File,
  // ) {
  //   const user = await this.findOne(id);
  //   if (!user) throw new NotFoundException('User not found');
  //   const { vacations, vacationsToDelete, type, start, end, ...rest } =
  //     userData;
  //   const roleKey =
  //     user.role === Role.USER ? 'client' : user.role.toLowerCase();
  //   const avatar = file?.path;

  //   // For barbers updating their slots, check if they have future orders
  //   let effectiveSlotDate: Date | null = null;
  //   let shouldUpdateImmediately = true;

  //   if (user.role === Role.BARBER && (start || end)) {
  //     // Check if barber's current slot is empty
  //     const barberSlot = await this.prisma.slot.findFirst({
  //       where: { barberId: user.id },
  //       select: { slot: true, start: true, end: true },
  //     });

  //     const isSlotEmpty =
  //       !barberSlot || !barberSlot.slot || barberSlot.slot.length === 0;

  //     if (isSlotEmpty) {
  //       // Slot is empty, update immediately
  //       shouldUpdateImmediately = true;
  //       effectiveSlotDate = null;
  //     } else {
  //       const currentStart = barberSlot.start;
  //       const currentEnd = barberSlot.end;
  //       const newStart = start ?? currentStart;
  //       const newEnd = end ?? currentEnd;

  //       // If the new range fully covers the existing range, all booked slots remain valid
  //       const isExpanding = newStart <= currentStart && newEnd >= currentEnd;

  //       if (isExpanding) {
  //         shouldUpdateImmediately = true;
  //         effectiveSlotDate = null;
  //       } else {
  //         const latestOrderDate = await this.getLatestOrderDate(user.id);

  //         if (latestOrderDate) {
  //           const today = new Date();
  //           today.setHours(0, 0, 0, 0);

  //           const latestOrderDateOnly = new Date(latestOrderDate);
  //           latestOrderDateOnly.setHours(0, 0, 0, 0);

  //           // If last order day < today, update immediately
  //           if (latestOrderDateOnly < today) {
  //             shouldUpdateImmediately = true;
  //             effectiveSlotDate = null;
  //           } else {
  //             // Set effective slot date to the day after the last order
  //             effectiveSlotDate = addDays(latestOrderDateOnly, 1);
  //             shouldUpdateImmediately = false;
  //           }
  //         } else {
  //           // No future orders, update immediately
  //           shouldUpdateImmediately = true;
  //           effectiveSlotDate = null;
  //         }
  //       }
  //     }
  //   }

  //   const updateUser = await this.prisma.user.update({
  //     where: { id },
  //     data: {
  //       ...rest,
  //       ...(avatar && { avatar }),
  //       ...((vacations || vacationsToDelete || start || end || type) &&
  //         user.role !== Role.USER && {
  //           [roleKey]: {
  //             update: {
  //               ...((vacationsToDelete || vacations) && {
  //                 vacations: {
  //                   ...(vacationsToDelete && {
  //                     deleteMany: {
  //                       id: { in: vacationsToDelete },
  //                     },
  //                   }),
  //                   ...(vacations && {
  //                     upsert: vacations.map((vacation) => ({
  //                       where: { id: vacation.id || 'new' },
  //                       create: {
  //                         dates: vacation.dates.map((v) => {
  //                           const dateWithoutTime = v.split('T')[0];
  //                           return new Date(dateWithoutTime);
  //                         }),
  //                         month: new Date(vacation.month),
  //                       },
  //                       update: {
  //                         dates: vacation.dates.map((v) => {
  //                           const dateWithoutTime = v.split('T')[0];
  //                           return new Date(dateWithoutTime);
  //                         }),
  //                         month: new Date(vacation.month),
  //                       },
  //                     })),
  //                   }),
  //                 },
  //               }),
  //               ...((start || end) && {
  //                 Slot: {
  //                   update: shouldUpdateImmediately
  //                     ? {
  //                         data: {
  //                           slot: await this.AuthService.generateSlots(
  //                             start,
  //                             end,
  //                           ),
  //                           effectiveSlotDate: null,
  //                           updatedSlot: [],
  //                           end,
  //                           start,
  //                         },
  //                       }
  //                     : {
  //                         data: {
  //                           updatedSlot: await this.AuthService.generateSlots(
  //                             start,
  //                             end,
  //                           ),
  //                           effectiveSlotDate,
  //                           end,
  //                           start,
  //                         },
  //                       },
  //                 },
  //               }),
  //               ...(user.role === Role.BARBER && { type }),
  //             },
  //           },
  //         }),
  //     },
  //     select: {
  //       id: true,
  //       firstName: true,
  //       lastName: true,
  //       avatar: true,
  //       phone: true,
  //       ...(user.role === Role.BARBER && {
  //         barber: { include: { vacations: true, Slot: true } },
  //       }),
  //       ...(user.role === Role.CASHIER && {
  //         cashier: { include: { vacations: true, Slot: true } },
  //       }),
  //       ...(user.role === Role.USER && {
  //         client: { select: this.client },
  //       }),
  //       ...(user.role === Role.ADMIN && {
  //         admin: true,
  //       }),
  //     },
  //   });
  //   console.log(updateUser);

  //   return new AppSuccess(updateUser, 'User updated successfully', 200);
  // }

  public async CurrentUser(user: User) {
    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        ...this.user,
        barber: { select: this.barber },
        cashier: { select: this.cashier },
        client: { select: this.client },
      },
    });

    if (!userWithRole) throw new NotFoundException('User not found');

    const { barber, cashier, client, ...rest } = userWithRole;
    const userRole =
      user.role === Role.USER ? 'client' : user.role.toLowerCase();

    const processSlotInfo = (employeeData: any) => {
      if (!employeeData || !employeeData.Slot) return employeeData;

      const { Slot, ...restData } = employeeData;
      const today = new Date().toISOString().split('T')[0];

      return {
        ...restData,
        schedule: {
          workingHours: {
            start: Slot.start,
            end: Slot.end,
          },
          currentSlots: Slot.slot || [],
          ...(Slot.updatedSlot &&
            Slot.updatedSlot.length > 0 && {
              newSlots: Slot.updatedSlot,
              effectiveDate: Slot.effectiveSlotDate
                ?.toISOString()
                .split('T')[0],
              isNewSlotActive: Slot.effectiveSlotDate
                ? today >= Slot.effectiveSlotDate.toISOString().split('T')[0]
                : false,
            }),
        },
      };
    };

    let roleData;
    if (userRole === 'barber') {
      roleData = processSlotInfo(barber);
    } else if (userRole === 'cashier') {
      roleData = processSlotInfo(cashier);
    } else if (userRole === 'client') {
      roleData = {
        ...client,
        ...(client?.ban && {
          BanMessage: "You can't make any Order please get contact with us",
        }),
      };
    }

    return new AppSuccess(
      {
        ...rest,
        ...(userRole !== 'admin' && { [userRole]: roleData }),
      },
      'User fetched successfully',
      200,
    );
  }

  public async updateBarberAvailability(id: string) {
    try {
      const existing = await this.prisma.barber.findUnique({
        where: { id },
        select: { isAvailable: true },
      });
      const barber = await this.prisma.barber.update({
        where: { id },
        data: { isAvailable: !existing.isAvailable },
      });
      return new AppSuccess(
        barber,
        'Barber availability updated successfully',
        200,
      );
    } catch (err) {
      this.logger.error('Error updating barber availability:', err.message);
      throw new InternalServerErrorException(
        'Failed to update barber availability',
      );
    }
  }

  private async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.user,
        admin: true,
        barber: { select: this.barber },
        cashier: { select: this.cashier },
        client: { select: this.client },
      },
    });

    const { admin, barber, cashier, client, ...rest } = user;
    const userRole =
      user.role.toUpperCase() === Role.USER
        ? 'client'
        : user.role.toLowerCase();

    if (!user) throw new NotFoundException('User not found');

    const processSlotInfo = (employeeData: any) => {
      if (!employeeData || !employeeData.Slot) return employeeData;

      const { Slot, ...restData } = employeeData;
      console.log('Processing slot info:', Slot);
      const today = new Date().toISOString().split('T')[0];

      return {
        ...restData,
        schedule: {
          workingHours: {
            start: Slot.start,
            end: Slot.end,
          },
          currentSlots: Slot.slot || [],
          ...(Slot.updatedSlot &&
            Slot.updatedSlot.length > 0 && {
              newSlots: Slot.updatedSlot,
              effectiveDate: Slot.effectiveSlotDate
                ?.toISOString()
                .split('T')[0],
              isNewSlotActive: Slot.effectiveSlotDate
                ? today >= Slot.effectiveSlotDate.toISOString().split('T')[0]
                : false,
            }),
        },
      };
    };

    let roleData = admin || client;
    if (barber) {
      roleData = processSlotInfo(barber);
    } else if (cashier) {
      roleData = processSlotInfo(cashier);
    }

    return { ...rest, [userRole]: roleData };
  }

  async unbanUser(phone: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (!user) throw new NotFoundException('User not found');

    const updatedUser = await this.prisma.user.update({
      where: { phone },
      data: {
        client: {
          update: { ban: false, canceledOrders: 0 },
        },
      },
    });
    return new AppSuccess(updatedUser, 'User unbanned successfully', 200);
  }

  public async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
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

    return new AppSuccess(null, 'User deleted successfully', 200);
  }

  async deleteEmployee(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        BarberOrders: true,
        CashierOrders: true,
      },
    });

    switch (user.role) {
      case Role.BARBER:
        if (user.BarberOrders.length > 0) {
          await this.prisma.order.updateMany({
            where: { barberId: id },
            data: {
              barberId: null,
              barberName: user.firstName + ' ' + user.lastName,
            },
          });
        }
        await this.prisma.barber.delete({
          where: { id },
        });
        await this.prisma.user.delete({
          where: { id },
        });
        break;
      case Role.CASHIER:
        if (user.CashierOrders.length > 0) {
          await this.prisma.order.updateMany({
            where: { cashierId: id },
            data: { cashierId: null },
          });
        }
        await this.prisma.cashier.delete({
          where: { id },
        });
        await this.prisma.user.delete({
          where: { id },
        });
        break;
    }
    return new AppSuccess(null, 'Employee deleted successfully', 200);
  }

  async hasOrdersBetweenDates(userId: string, startDate: Date, endDate: Date) {
    const orderCount = await this.prisma.order.count({
      where: {
        userId: userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const hasOrders = orderCount > 0;

    return !hasOrders;
  }

  async getLatestOrderDate(barberId: string): Promise<Date | null> {
    const latestOrder = await this.prisma.order.findFirst({
      where: {
        barberId: barberId,
        booking: {
          in: [BookingStatus.UPCOMING],
        },
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
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
      },
    });

    return latestOrder?.date || null;
  }

  async rateBarber(
    clientId: string,
    barberId: string,
    orderId: string,
    rate: number,
  ) {
    // 1. Verify barber exists
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true } },
      },
    });

    if (!barber) throw new NotFoundException('Barber not found');

    // 2. Verify the order belongs to this client, is with this barber, and is completed
    const completedOrder = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: clientId,
        barberId,
        status: { in: ['COMPLETED', 'PAID'] },
        deleted: false,
      },
    });

    if (!completedOrder) {
      throw new NotFoundException(
        'No completed order found for this barber and client',
      );
    }

    // 3. Check if this order was already rated
    const existingRating = await this.prisma.barberRating.findUnique({
      where: { barberId_clientId_orderId: { barberId, clientId, orderId } },
    });

    if (existingRating) {
      throw new ConflictException('This order has already been rated');
    }

    // 4. Create new rating row
    await this.prisma.barberRating.create({
      data: { barberId, clientId, orderId, rate },
    });

    // 4. Recalculate average rating
    const { _avg } = await this.prisma.barberRating.aggregate({
      where: { barberId },
      _avg: { rate: true },
      _count: { rate: true },
    });

    // 5. Update barber's average rating
    const updatedBarber = await this.prisma.barber.update({
      where: { id: barberId },
      data: { rate: _avg.rate || 0 },
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true } },
      },
    });

    // 6. Return success
    return new AppSuccess(
      {
        barber: {
          id: updatedBarber.id,
          name: `${updatedBarber.user.firstName} ${updatedBarber.user.lastName}`,
          avatar: updatedBarber.user.avatar,
          rate: Number(updatedBarber.rate.toFixed(1)),
        },
        yourRate: rate,
      },
      'Barber rated successfully',
      200,
    );
  }
}
