import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { hash } from 'bcrypt';
import { Role } from '@prisma/client';
import { DEFAULT_PASSWORD } from '../../../utils/constants';
import { TokenOperationsService } from './token-operations.service';

@Injectable()
export class AuthPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenOps: TokenOperationsService,
  ) {}

  public async changePassword(id: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const hashedPassword = await hash(password, 10);

    try {
      await this.prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
        omit: { password: true },
      });
      await this.tokenOps.invalidateAllUserTokens(id);
      return null;
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Failed to change password');
    }
  }

  public async resetPassword(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role?.toUpperCase() === Role.ADMIN) {
      throw new BadRequestException('Admin cannot reset password');
    }

    const hashedPassword = await hash(DEFAULT_PASSWORD, 10);

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
        omit: { password: true },
      });
      await this.tokenOps.invalidateAllUserTokens(user.id);
      return null;
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new InternalServerErrorException('Failed to reset password');
    }
  }
}
