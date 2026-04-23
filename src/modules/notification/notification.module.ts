import { Module, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationQueryService } from './services/notification-query.service';
import { NotificationMutationService } from './services/notification-mutation.service';
import { NotificationScheduler } from './services/notificationScheduler';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationQueryService,
    NotificationMutationService,
    NotificationScheduler,
  ],
  exports: [NotificationService, NotificationScheduler],
})
export class NotificationModule implements OnModuleInit {
  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY as string).replace(
            /\\n/g,
            '\n',
          ),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
  }
}
