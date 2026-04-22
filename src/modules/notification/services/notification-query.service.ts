import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AppSuccess } from '@/utils/AppSuccess';

@Injectable()
export class NotificationQueryService {
  constructor(readonly prisma: PrismaService) {}

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
}
