import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { PromoCodeService } from '../../promo-code/promo-code.service';
import { OrderQueryService } from './order-query.service';
import { PaidOrderBodyDto } from '../dto/paid-order-body.dto';
import { BookingStatus, OrderStatus, PromoCode, Role } from '@prisma/client';

@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly promoCodeService: PromoCodeService,
    private readonly orderQuery: OrderQueryService,
  ) {}

  async startOrder(id: string) {
    await this.orderQuery.findOneOrFail(id);
    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.IN_PROGRESS,
        booking: BookingStatus.UPCOMING,
      },
    });
  }

  async completeOrder(id: string) {
    await this.orderQuery.findOneOrFail(id);

    return this.prisma.$transaction(async (prisma) => {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: { status: OrderStatus.COMPLETED, booking: BookingStatus.PAST },
        include: {
          service: { include: { PackagesServices: { select: { id: true } } } },
          client: { select: { fcmToken: true } },
          barber: {
            select: { id: true, avatar: true, firstName: true, lastName: true },
          },
        },
      });

      await this.notificationService.sendNotification({
        fcmTokens: [updatedOrder.client.fcmToken],
        title: 'Order completed',
        message: 'We hope you had a great experience with us',
        data: {
          orderId: updatedOrder.id,
          barberId: updatedOrder.barber.id,
          barberAvatar: updatedOrder.barber.avatar,
          barberName: `${updatedOrder.barber.firstName} ${updatedOrder.barber.lastName}`,
        },
      });

      const packageServiceIds = updatedOrder.service.flatMap((s) =>
        s.PackagesServices.map((ps) => ps.id),
      );
      if (packageServiceIds.length > 0 && updatedOrder.userId) {
        await this.prisma.packagesServices.deleteMany({
          where: {
            id: { in: packageServiceIds },
            ClientPackages: { clientId: updatedOrder?.userId },
            remainingCount: { lt: 1 },
          },
        });
      }

      if (updatedOrder.usedPackage && updatedOrder.userId) {
        await prisma.clientPackages.deleteMany({
          where: {
            id: { in: updatedOrder?.usedPackage },
            clientId: updatedOrder?.userId,
          },
        });
      }

      return updatedOrder;
    });
  }

  async cancelOrder(id: string, role: Role) {
    this.orderQuery.findOneOrFail(id);
    const settings = await this.prisma.settings.findFirst({
      select: { canceledOrder: true },
    });

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      include: {
        service: { include: { PackagesServices: { select: { id: true } } } },
      },
      data: {
        booking: BookingStatus.CANCELLED,
        ...(role === Role.ADMIN && { status: OrderStatus.ADMIN_CANCELLED }),
        ...(role === Role.USER && { status: OrderStatus.CLIENT_CANCELLED }),
        ...(role === Role.BARBER && { status: OrderStatus.BARBER_CANCELLED }),
        ...(role === Role.CASHIER && { status: OrderStatus.CASHIER_CANCELLED }),
      },
    });

    if (updatedOrder.points && updatedOrder.points > 0) {
      const client = await this.prisma.client.findUnique({
        where: { id: updatedOrder.userId },
      });
      if (client) {
        await this.prisma.client.update({
          where: { id: updatedOrder.userId },
          data: { points: { increment: updatedOrder.points } },
        });
      }
    }

    const nonCancellable: OrderStatus[] = [
      OrderStatus.IN_PROGRESS,
      OrderStatus.COMPLETED,
      OrderStatus.PAID,
    ];
    if (nonCancellable.includes(updatedOrder.status)) {
      throw new ConflictException(
        'Order cannot be cancelled, it has already started or completed.',
      );
    }

    const packageServiceIds = updatedOrder.service.flatMap((s) =>
      s.PackagesServices.map((ps) => ps.id),
    );

    await this.prisma.$transaction(async (prisma) => {
      if (packageServiceIds.length >= 1) {
        await prisma.packagesServices.updateMany({
          where: {
            id: { in: packageServiceIds },
            ClientPackages: { clientId: updatedOrder.userId, type: 'SINGLE' },
          },
          data: {
            isActive: true,
            usedAt: null,
            remainingCount: { increment: 1 },
          },
        });
      }
      if (updatedOrder.usedPackage) {
        await prisma.clientPackages.updateMany({
          where: {
            id: { in: updatedOrder.usedPackage },
            clientId: updatedOrder.userId,
            type: 'MULTIPLE',
          },
          data: { isActive: true },
        });
      }
      const client = await prisma.client.findUnique({
        where: { id: updatedOrder.userId },
      });
      if (client) {
        const updatedClient = await prisma.client.update({
          where: { id: updatedOrder.userId },
          data: { canceledOrders: { increment: 1 } },
        });
        if (updatedClient.canceledOrders >= settings?.canceledOrder) {
          await prisma.client.update({
            where: { id: updatedOrder.userId },
            data: { ban: true },
          });
        }
      }
    });

    return updatedOrder;
  }

  async paidOrder(id: string, body?: PaidOrderBodyDto) {
    const { discount, points } = body ?? {};

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
        select: {
          subTotal: true,
          total: true,
          client: {
            select: {
              id: true,
              role: true,
              client: { select: { points: true } },
            },
          },
        },
      }),
      this.prisma.settings.findFirst(),
    ]);

    if (!currentOrder)
      throw new ConflictException('Order is either PAID or cancelled');

    const user = currentOrder.client;
    let pointsDiscount = 0;
    let code: PromoCode;
    let total = currentOrder.total;

    if (points) {
      if (!settings) throw new NotFoundException('Settings not found');
      pointsDiscount = this.orderQuery.validatePoints(
        total,
        points,
        user.client.points ?? 0,
        settings.pointLimit,
      );
      total = total - pointsDiscount;
    }

    if (discount) {
      if (discount < 0)
        throw new BadRequestException('Discount cannot be negative');
      if (discount > 100)
        throw new BadRequestException('Discount cannot be greater than 100%');
      code = await this.promoCodeService
        .createPromoCode({
          code: undefined,
          discount,
          type: 'PERCENTAGE',
          expiredAt: new Date(Date.now() + 60 * 1000),
        })
        .then((res) => res.data);
      total = total - (total * code.discount) / 100;
    }

    await this.orderQuery.findOneOrFail(id);

    if (points) {
      const pointUsed = Math.floor(points / 1000) * 1000;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { client: { update: { points: { decrement: pointUsed } } } },
      });
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PAID,
        booking: 'PAST',
        ...(user.role === 'CASHIER' && { cashierId: user.id }),
        ...(code && {
          promoCode: code.code,
          discount: code.discount,
          type: 'PERCENTAGE',
        }),
        subTotal: currentOrder.subTotal,
        total,
      },
      include: {
        service: true,
        barber: { select: { firstName: true, lastName: true } },
        branch: { include: {} },
      },
    });
  }
}
