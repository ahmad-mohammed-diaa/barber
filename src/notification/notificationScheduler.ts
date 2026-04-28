import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { getOrderDateTime } from 'src/utils/lib';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async notifyUpcomingAppointments() {
    this.logger.log('Checking upcoming orders...');

    const now = new Date();
    const windowStart = new Date(now.getTime() + 29 * 60_000);
    const windowEnd = new Date(now.getTime() + 30 * 60_000);

    const orders = await this.prisma.order.findMany({
      where: {
        booking: 'UPCOMING',
        reminderSent: false,
        deleted: false,
        status: 'PENDING',
      },
      include: {
        client: { select: { fcmToken: true } },
        barber: {
          select: { id: true, avatar: true, firstName: true, lastName: true },
        },
      },
    });

    if (orders.length === 0) {
      return;
    }

    for (const order of orders) {
      const result = getOrderDateTime(order);
      if (!result) continue;

      const { date, fcmToken } = result;
      if (!fcmToken) continue;

      if (date < windowStart || date > windowEnd) continue;

      try {
        await this.notificationService.sendNotification({
          fcmTokens: [fcmToken],
          title: '⏰ موعدك اقترب',
          message: 'تبقى 30 دقيقة على موعدك، ننتظرك بكل حماس لجلستك اليوم',
        });

        await this.prisma.order.update({
          where: { id: order.id },
          data: { reminderSent: true },
        });

        this.logger.log(`Notified order ${order.id}`);
      } catch (err) {
        this.logger.error(`Notification failed for ${order.id}, ${err}`);
      }
    }
  }
}
