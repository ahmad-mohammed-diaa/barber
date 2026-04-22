import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { compare } from 'bcrypt';
import { LoginDto } from '../dto/auth-login-dto';
import { TokenOperationsService } from './token-operations.service';

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenOps: TokenOperationsService,
  ) {}

  public async login(createAuthDto: LoginDto) {
    const { phone, password } = createAuthDto;

    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user || user.deleted)
      throw new NotFoundException('Invalid Phone number or password');

    const isPasswordCorrect = await compare(password, user.password);
    if (!isPasswordCorrect)
      throw new NotFoundException('Invalid Phone number or password');

    const userWithoutPassword = await this.prisma.user.findUnique({
      where: { phone },
      omit: { password: true },
    });

    const token = await this.tokenOps.generateToken(user.id);

    return {
      data: userWithoutPassword,
      token,
      message: 'login successfully',
      statusCode: 201,
    };
  }

  public async logout(token: string) {
    await this.tokenOps.invalidateToken(token);
    return null;
  }
}
