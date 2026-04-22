import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { getOrderDateTime } from '@/utils/lib';
import { NotificationMutationService } from './notification-mutation.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationMutation: NotificationMutationService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
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
      if (!date || !fcmToken) continue;

      if (date > now && date <= threshold) {
        try {
          await this.notificationMutation.sendNotification({
            fcmTokens: [fcmToken], // ✅ Must be a string, not an array
            title: '⏰ موعدك اقترب',
            message: 'تبقى 30 دقيقة على موعدك، ننتظرك بكل حماس لجلستك اليوم',

            data: {
              barberId: order.barber?.id ?? '',
              barberAvatar: order.barber?.avatar ?? '',
              barberName: `${order.barber?.firstName ?? ''} ${order.barber?.lastName ?? ''}`,
            },
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
}
