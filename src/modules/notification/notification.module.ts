import { Module } from '@nestjs/common';
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
export class NotificationModule {}
