import { Controller, Post, Body, UseGuards, Put, Get } from '@nestjs/common';
import { NotificationService } from './notification.service';
import * as admin from 'firebase-admin';
import { AuthGuard } from 'guard/auth.guard';
import { UserData } from 'decorators/user.decorator';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@UseGuards(AuthGuard())
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly NotificationService: NotificationService,
    private readonly prisma: PrismaService,
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

  @Put('set-fcm')
  setFCM(@UserData('user') user: User, @Body() body) {
    return this.NotificationService.setFCMToken(user, body.fcmToken);
  }

  @Post('send-notification')
  async sendNotification(
    // @UserData('user') user: User,
    @Body()
    body: {
      fcmTokens: string[];
      title: string;
      message: string;
      imageUrl?: string;
    },
  ) {
    return this.NotificationService.sendNotification(body);
  }

  @Get('get-history')
  getNotification(@UserData('user') user: User) {
    return this.NotificationService.getNotification(user);
  }

  // @Get('set')
  // se() {
  //  const a = admin
  //     .messaging()
  //     .subscribeToTopic(
  //       'efbeMVbMSo6LoQyiuMXh2T:APA91bHz6ziWxeOrU3J8sWi025T3pLOFRFKlbapAkrGvFGCGtWBNByQSRusEYWrPmL_Bxg4nERycquu0XWkFpXZjrZbz299xo7DkRSaceqE67UYBOAU9pIM',
  //       'packages',
  //   );
  //   return a
  // }
}
