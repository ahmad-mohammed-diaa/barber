import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FindAllUsersDto } from '../dto/find-all-users.dto';
import { FindAllClientsDto } from '../dto/find-all-clients.dto';

@Injectable()
export class UserQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
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

  private readonly clientSelect = {
    id: false,
    referralCode: true,
    points: true,
    ban: true,
    canceledOrders: true,
  } as Prisma.ClientSelect;

  private readonly barberSelect = {
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
  } as Prisma.BarberSelect;

  private readonly cashierSelect = {
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

  private processSlotInfo(employeeData: any) {
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
            effectiveDate: Slot.effectiveSlotDate?.toISOString().split('T')[0],
            isNewSlotActive: Slot.effectiveSlotDate
              ? today >= Slot.effectiveSlotDate.toISOString().split('T')[0]
              : false,
          }),
      },
    };
  }

  public async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.userSelect,
        admin: true,
        barber: { select: this.barberSelect },
        cashier: { select: this.cashierSelect },
        client: { select: this.clientSelect },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { admin, barber, cashier, client, ...rest } = user;
    const userRole =
      user.role.toUpperCase() === Role.USER ? 'client' : user.role.toLowerCase();

    let roleData = admin || client;
    if (barber) {
      roleData = this.processSlotInfo(barber);
    } else if (cashier) {
      roleData = this.processSlotInfo(cashier);
    }

    return { ...rest, [userRole]: roleData };
  }

  public async findOneUser(id: string) {
    const user = await this.findOne(id);
    return user;
  }

  public async findAllUser(
    page = 1,
    pageSize = 10,
    role?: Role,
  ) {
    if (role && !Role[role?.toUpperCase()]) {
      throw new NotFoundException('Role not found');
    }

    const include = role
      ? {
          [role?.toLowerCase()]: {
            select:
              Role[role.toUpperCase()] === 'ADMIN'
                ? ({ id: true } as Prisma.AdminSelect)
                : Role[role.toUpperCase()] === 'BARBER'
                  ? this.barberSelect
                  : Role[role.toUpperCase()] === 'CASHIER'
                    ? this.cashierSelect
                    : this.clientSelect,
          },
        }
      : {
          admin: false,
          barber: { select: this.barberSelect },
          cashier: { select: this.cashierSelect },
        };

    const fetchedUsers = await this.prisma.user.findMany({
      where: { role: Role[role?.toUpperCase()] ?? { not: Role.USER } },
      skip: (page - 1) * pageSize,
      take: +pageSize,
      select: { ...this.userSelect, ...include },
    });

    const users = fetchedUsers.map(({ barber, cashier, ...user }) => ({
      ...user,
      ...(barber && { barber: this.processSlotInfo(barber) }),
      ...(cashier && { cashier: this.processSlotInfo(cashier) }),
    }));

    return { users };
  }

  public async findAllClients(page = 1, pageSize = 10, phone?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        role: Role.USER,
        ...(phone && { phone }),
      },
      select: {
        ...this.userSelect,
        client: { select: this.clientSelect },
      },
      skip: (page - 1) * pageSize,
      take: +pageSize,
    });

    return { users };
  }

  public async currentUser(user: User) {
    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        ...this.userSelect,
        barber: { select: this.barberSelect },
        cashier: { select: this.cashierSelect },
        client: { select: this.clientSelect },
      },
    });

    if (!userWithRole) throw new NotFoundException('User not found');

    const { barber, cashier, client, ...rest } = userWithRole;
    const userRole =
      user.role === Role.USER ? 'client' : user.role.toLowerCase();

    let roleData;
    if (userRole === 'barber') {
      roleData = this.processSlotInfo(barber);
    } else if (userRole === 'cashier') {
      roleData = this.processSlotInfo(cashier);
    } else if (userRole === 'client') {
      roleData = {
        ...client,
        ...(client?.ban && {
          BanMessage: "You can't make any Order please get contact with us",
        }),
      };
    }

    return {
      ...rest,
      ...(userRole !== 'admin' && { [userRole]: roleData }),
    };
  }
}
