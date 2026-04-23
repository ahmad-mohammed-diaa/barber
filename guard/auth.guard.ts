import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  mixin,
} from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtPayload } from 'jsonwebtoken';
export function AuthGuard(required = true): any {
  @Injectable()
  class AuthGuard implements CanActivate {
    constructor(
      private readonly prisma: PrismaService,
      private readonly authService: AuthService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const req = context.switchToHttp().getRequest();
      // const fcmToken =
      //   req.headers['NotificationCode'] || req.headers['notificationcode'];
      const token =
        req.headers['authorization']?.split(' ')[1] ||
        req.headers['Authorization']?.split(' ')[1];
      const apiKeyHeader = req.headers['x-api-key'];

      let isAuthenticated = false;

      if (token) {
        const result = await this.prisma.token.findUnique({ where: { token } });

        try {
          if (result) {
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

            // if (!user.fcmToken || user.fcmToken !== fcmToken) {
            //   await this.prisma.user.update({
            //     where: { id },
            //     data: { fcmToken },
            //   });
            // }

            req.user = user;
            req.token = token;
            isAuthenticated = true;
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          throw new UnauthorizedException('Invalid credentials');
        }
      }
      if (apiKeyHeader) {
        try {
          const decoded = Buffer.from(apiKeyHeader, 'base64').toString('utf-8');
          if (decoded === process.env.API_KEY) {
            req.apiKeyUser = { role: 'api', access: 'basic' };
          }
        } catch (error) {
          console.error('API key verification failed:', error);
          throw new UnauthorizedException('Invalid API key');
        }
      }
      if (required && !isAuthenticated) {
        throw new UnauthorizedException('Authentication required');
      }
      if (!isAuthenticated && !apiKeyHeader) {
        throw new UnauthorizedException('Authentication required');
      }
      return true;
    }
  }
  return mixin(AuthGuard);
}
