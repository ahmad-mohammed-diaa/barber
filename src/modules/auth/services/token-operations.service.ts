import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TokenOperationsService {
  private readonly jwtSecret = process.env.JWT_SECRET;

  constructor(private readonly prisma: PrismaService) {}

  public verifyToken(token: string) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid token',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public async loginToken(token: string, userId?: string) {
    const decoded = jwt.decode(token);
    if (typeof decoded === 'object' && decoded !== null) {
      const expiredAt =
        'exp' in decoded
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      return await this.prisma.token.create({
        data: { token, expiredAt, userId },
      });
    }
    throw new Error('Invalid token');
  }

  public async generateToken(userId: string) {
    const token = jwt.sign({ userId }, this.jwtSecret);
    await this.loginToken(token, userId);
    return token;
  }

  public async invalidateToken(token: string) {
    const isToken = await this.prisma.token.findUnique({ where: { token } });
    if (!isToken) throw new UnauthorizedException('User already logged out');
    return await this.prisma.token.delete({ where: { token } });
  }

  public async invalidateAllUserTokens(userId: string) {
    await this.prisma.token.deleteMany({ where: { userId } });
  }
}
