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

  // @Cron(CronExpression.EVERY_MINUTE)
  async notifyUpcomingAppointments() {
    this.logger.log('Checking upcoming orders...');

    console.log('notification send successfully');
    const now = new Date();
    const threshold = new Date(now.getTime() + 30 * 60000);

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
      console.log('no upcoming orders found');
      return;
    }
    for (const order of orders) {
      const { date, fcmToken } = getOrderDateTime(order);
      const d = new Date(date);
      if (!d || !fcmToken) continue;

      if (d > now && date <= threshold) {
        try {
          console.log('sending notification');
          await this.notificationService.sendNotification({
            fcmTokens: [fcmToken], // ✅ Must be a string, not an array
            title: '⏰ موعدك اقترب',
            message: 'تبقى 30 دقيقة على موعدك، ننتظرك بكل حماس لجلستك اليوم',
          });

          this.logger.log(`Notified order ${order.id}`);
        } catch (err) {
          this.logger.error(`Notification failed for ${order.id}, ${err}`);
        }
      }
    }
  }
}
