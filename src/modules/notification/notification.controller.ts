import {
  Controller,
  Post,
  Body,
  UseGuards,
  Put,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { AuthGuard } from '../../../guard/auth.guard';
import { UserData } from '../../../decorators/user.decorator';
import { User } from '@prisma/client';
import { NotificationScheduler } from './services/notificationScheduler';
import {
  TriggerReminderDoc,
  SetFCMDoc,
  SendNotificationDoc,
  GetNotificationHistoryDoc,
} from './notification.swagger';

@ApiTags('Notification')
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationScheduler: NotificationScheduler,
  ) {}

  @Get('reminder')
  @TriggerReminderDoc()
  async triggerReminder(@Headers('x-cron-secret') secret: string) {
    if (secret !== process.env.CRON_SECRET) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    await this.notificationScheduler.notifyUpcomingAppointments();
    return { success: true };
  }

  @UseGuards(AuthGuard())
  @Put('set-fcm')
  @SetFCMDoc()
  setFCM(@UserData('user') user: User, @Body() body) {
    return this.notificationService.setFCMToken(user, body.fcmToken);
  }

  @UseGuards(AuthGuard())
  @Post('send-notification')
  @SendNotificationDoc()
  async sendNotification(
    @Body()
    body: {
      fcmTokens: string[];
      title: string;
      message: string;
      imageUrl?: string;
      data?: Record<string, string>;
    },
  ) {
    return this.notificationService.sendNotification(body);
  }

  @UseGuards(AuthGuard())
  @Get('get-history')
  @GetNotificationHistoryDoc()
  getNotification(@UserData('user') user: User) {
    return this.notificationService.getNotification(user);
  }
}
