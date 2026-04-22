import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { NotificationQueryService } from './services/notification-query.service';
import { NotificationMutationService } from './services/notification-mutation.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationQuery: NotificationQueryService,
    private readonly notificationMutation: NotificationMutationService,
  ) {}

  getNotification(user: User) {
    return this.notificationQuery.getNotification(user);
  }

  setFCMToken(user: User, fcmToken: string) {
    return this.notificationMutation.setFCMToken(user, fcmToken);
  }

  sendNotification(body: {
    fcmTokens: string[];
    title: string;
    message: string;
    imageUrl?: string;
    userId?: string;
    data?: Record<string, string>;
  }) {
    return this.notificationMutation.sendNotification(body);
  }

  sendNotificationToAllUsers(body: {
    title: string;
    message: string;
    imageUrl?: string;
  }) {
    return this.notificationMutation.sendNotificationToAllUsers(body);
  }
}
