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
import { NotificationService } from './notification.service';
import * as admin from 'firebase-admin';
import { AuthGuard } from '../../guard/auth.guard';
import { UserData } from '../../decorators/user.decorator';
import { User } from '@prisma/client';
import { NotificationScheduler } from './notificationScheduler';

@Controller('notification')
export class NotificationController {
  constructor(
    private readonly NotificationService: NotificationService,
    private readonly notificationScheduler: NotificationScheduler,
  ) {
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

  @Get('reminder')
  async triggerReminder(@Headers('x-cron-secret') secret: string) {
    if (secret !== process.env.CRON_SECRET) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    await this.notificationScheduler.notifyUpcomingAppointments();
    return { success: true };
  }

  @UseGuards(AuthGuard())
  @Put('set-fcm')
  setFCM(@UserData('user') user: User, @Body() body) {
    return this.NotificationService.setFCMToken(user, body.fcmToken);
  }

  @UseGuards(AuthGuard())
  @Post('send-notification')
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
    return this.NotificationService.sendNotification(body);
  }

  @UseGuards(AuthGuard())
  @Get('get-history')
  getNotification(@UserData('user') user: User) {
    return this.NotificationService.getNotification(user);
  }
}
