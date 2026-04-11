import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSuccess } from 'src/utils/AppSuccess';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  constructor(readonly prisma: PrismaService) {}

  async setFCMToken(user: User, fcmToken: string) {
    console.log(fcmToken);
    console.log(user);
    const token = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        fcmToken,
      },
    });

    console.log(token);

    await admin.messaging().subscribeToTopic(fcmToken, 'packages');

    return new AppSuccess(
      { token: token.fcmToken },
      'FCM token updated successfully',
    );
  }

  async getNotification(user: User) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        user: { some: { id: user.id } },
      },
    });
    return new AppSuccess(
      { notifications },
      'Notifications retrieved successfully',
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
        ...users.map((u) =>
          this.prisma.user.update({
            where: { id: u.id },
            data: {
              notification: {
                create: {
                  content: body.message,
                  title: body.title,
                  ...(body.imageUrl && { image: body.imageUrl }),
                },
              },
            },
          }),
        ),
      ]);

      return new AppSuccess(
        noti,
        'Notification sent to all users successfully',
      );
    } catch (error) {
      console.log(error);
      return { error: 'Failed to send notification to all users' };
    }
  }
}
