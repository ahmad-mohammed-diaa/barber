import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationMutationService {
  private readonly logger = new Logger(NotificationMutationService.name);
  constructor(readonly prisma: PrismaService) {}

  async setFCMToken(user: User, fcmToken: string) {
    const token = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        fcmToken,
      },
    });

    await admin.messaging().subscribeToTopic(fcmToken, 'packages');

    return new AppSuccess(
      { token: token.fcmToken },
      'FCM token updated successfully',
    );
  }

  async sendNotification(body: {
    fcmTokens: string[];
    title: string;
    message: string;
    imageUrl?: string;
    userId?: string;
    data?: Record<string, string>;
  }) {
    try {
      const resolvedUserId =
        body.userId ??
        (await this.prisma.user
          .findFirst({
            where: { fcmToken: body.fcmTokens[0] },
            select: { id: true },
          })
          .then((u) => u?.id));

      const tasks: Promise<any>[] = [
        admin.messaging().sendEachForMulticast({
          tokens: body.fcmTokens,
          android: { notification: { color: '#000000' } },
          notification: {
            title: body.title,
            body: body.message,
            ...(body.imageUrl && { image: body.imageUrl }),
          },
          data: body.data,
        }),
      ];

      if (resolvedUserId) {
        tasks.push(
          this.prisma.user.update({
            where: { id: resolvedUserId },
            data: {
              notification: {
                create: {
                  title: body.title,
                  content: body.message,
                  image: body.imageUrl,
                },
              },
            },
          }),
        );
      }

      const [noti] = await Promise.all(tasks);
      return new AppSuccess(noti, 'Notification sent successfully');
    } catch {
      return { error: 'Failed to send notification' };
    }
  }

  async sendNotificationToAllUsers(body: {
    title: string;
    message: string;
    imageUrl?: string;
  }) {
    const users = await this.prisma.user.findMany({
      where: { fcmToken: { not: null } },
      select: { fcmToken: true, id: true },
    });

    if (users.length === 0) {
      throw new NotFoundException('No users found with FCM tokens');
    }

    try {
      const topicMessage: admin.messaging.Message = {
        topic: 'packages',
        android: { notification: { color: '#000000' } },
        notification: {
          title: body.title,
          body: body.message,
          ...(body.imageUrl && { image: body.imageUrl }),
        },
      };

      const [noti] = await Promise.all([
        admin.messaging().send(topicMessage),
        this.prisma.notification.create({
          data: {
            title: body.title,
            content: body.message,
            ...(body.imageUrl && { image: body.imageUrl }),
            user: { connect: users.map((u) => ({ id: u.id })) },
          },
        }),
      ]);

      return new AppSuccess(
        noti,
        'Notification sent to all users successfully',
      );
    } catch (error) {
      this.logger.error(error);
      return { error: 'Failed to send notification to all users' };
    }
  }
}
