import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from 'jsonwebtoken';
import { AuthService } from '../../modules/auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const token =
      req.headers['authorization']?.split(' ')[1] ||
      req.headers['Authorization']?.split(' ')[1];

    const apiKeyHeader = req.headers['api-key'];

    // Check JWT
    if (token) {
      const tokenRecord = await this.prisma.token.findUnique({
        where: { token },
      });
      if (tokenRecord) {
        try {
          const payload = this.authService.verifyToken(token) as JwtPayload;
          const id = payload.userId;
          const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
              admin: true,
              barber: true,
              cashier: true,
              client: true,
            },
          });

          const fcmToken =
            req.headers['NotificationCode'] || req.headers['notificationcode'];
          if (!user.fcmToken || user.fcmToken !== fcmToken) {
            await this.prisma.user.update({
              where: { id },
              data: { fcmToken },
            });
          }

          req.user = user;
          req.token = token;
        } catch (e) {
          // token invalid – ignore
        }
      }
    }

    // Check API Key
    if (apiKeyHeader) {
      try {
        const decoded = Buffer.from(apiKeyHeader, 'base64').toString('utf-8');
        if (decoded === process.env.API_KEY) {
          req.apiKeyUser = { role: 'api', access: 'basic' };
        }
      } catch (e) {
        // bad base64 – ignore
      }
    }

    return true; // Always allow request through
  }
}
