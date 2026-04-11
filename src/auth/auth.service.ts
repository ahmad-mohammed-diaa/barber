import {
  BadRequestException,
  ConflictException,
  Global,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { compare, hash } from 'bcrypt';
import { RegisterDto } from './dto/auth-register-dto';
import { LoginDto } from './dto/auth-login-dto';
import * as jwt from 'jsonwebtoken';
import { AppSuccess } from '../utils/AppSuccess';
import { Client, Prisma, Role, User } from '@prisma/client';
import { Random } from '../utils/generate';
import { DEFAULT_PASSWORD } from '../utils/constants';
import { AuthSlotService } from './services/auth-slot.service';
import { CreateUserService } from './services/create-user.service';
import { ReferralCodeService } from './services/referral-code.service';

@Global()
@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET;

  constructor(
    private prisma: PrismaService,
    private readonly authSlot: AuthSlotService,
    private readonly createUser: CreateUserService,
    private readonly authReferral: ReferralCodeService,
  ) {}

  public async signup(createAuthDto: RegisterDto, file: Express.Multer.File) {
    let user: Omit<User, 'password'>;
    let slot: string[] = [];
    const {
      phone,
      password,
      role = Role.USER,
      branchId,
      start,
      end,
      firstName,
      lastName,
      type,
      referralCode: code,
    } = createAuthDto;

    const ROLE = role.toUpperCase();
    const ExistsRole = (role: Role) => Role[ROLE] === role;

    if (ExistsRole(Role.BARBER) || ExistsRole(Role.CASHIER)) {
      slot = await this.authSlot.isBranchExistCreateSlot(branchId, start, end);
    }

    const userData = {
      firstName,
      lastName,
      phone,
      password: await hash(password, 10),
      ...(file && file.path && { avatar: file.path }),
    };
    const cashierData = {
      cashier: {
        create: {
          slot: { create: { start, end, slot } },
          branch: { connect: { id: branchId } },
        },
      },
    };
    const barberData = {
      barber: { create: { ...cashierData.cashier.create, type } },
    };
    const clientData = {
      client: { create: { referralCode: Random(6) } },
    };
    const AdminData = { admin: { create: {} } };

    try {
      switch (ROLE) {
        case Role.ADMIN:
          user = await this.createUser.create(
            this.prisma,
            userData,
            AdminData,
            Role.ADMIN,
          );
          break;
        case Role.USER:
          user = await this.prisma.$transaction(async (tx) => {
            const createdUser = await this.createUser.create(
              tx,
              userData,
              clientData,
              Role.USER,
            );

            if (code) {
              await this.authReferral.handleReferralCode(
                tx,
                createdUser.id,
                code,
              );
            }

            return createdUser;
          });
          break;
        case Role.BARBER:
          user = await this.createUser.create(
            this.prisma,
            userData,
            barberData,
            Role.BARBER,
          );
          break;
        case Role.CASHIER:
          user = await this.createUser.create(
            this.prisma,
            userData,
            cashierData,
            Role.CASHIER,
          );
          break;
        default:
          throw new BadRequestException('INVALID_ROLE');
      }
      const token = await this.generateToken(user.id);

      return {
        data: user,
        ...(role.toUpperCase() === Role.USER && { token }),
        message: 'User registered successfully',
        statusCode: 201,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to register user';
      throw new InternalServerErrorException(
        err,
        errorMessage ?? 'Failed to register user',
      );
    }
  }

  public async login(createAuthDto: LoginDto) {
    const { phone, password } = createAuthDto;

    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user || user.deleted)
      throw new NotFoundException('Invalid Phone number or password');

    const isPasswordCorrect = await compare(password, user.password);

    if (!isPasswordCorrect)
      throw new NotFoundException('Invalid Phone number or password');

    const userWithoutPassword = await this.prisma.user.findUnique({
      where: { phone },
      omit: { password: true },
    });

    const token = await this.generateToken(user.id);

    return {
      data: userWithoutPassword,
      token,
      message: 'login successfully',
      statusCode: 201,
    };
  }

  public async logout(token: string) {
    await this.invalidateToken(token);
    return new AppSuccess(null, 'logout successfully', 200);
  }

  public verifyToken(token: string) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new UnauthorizedException('Invalid token', error.message);
    }
  }

  public async invalidateToken(token: string) {
    const isToken = await this.prisma.token.findUnique({ where: { token } });
    if (!isToken) throw new UnauthorizedException('User already logged out');
    return await this.prisma.token.delete({
      where: { token },
    });
  }

  private async invalidateAllUserTokens(userId: string) {
    // Get all tokens from database
    const allTokens = await this.prisma.token.findMany();

    // Filter tokens that belong to this user by decoding them
    const userTokenIds: string[] = [];
    for (const tokenRecord of allTokens) {
      try {
        const decoded = jwt.decode(tokenRecord.token);
        if (
          decoded &&
          typeof decoded === 'object' &&
          'userId' in decoded &&
          decoded.userId === userId
        ) {
          userTokenIds.push(tokenRecord.id);
        }
      } catch {
        // Skip invalid tokens
        continue;
      }
    }

    // Delete all tokens belonging to this user
    if (userTokenIds.length > 0) {
      await this.prisma.token.deleteMany({
        where: {
          id: {
            in: userTokenIds,
          },
        },
      });
    }
  }

  public async loginToken(token: string) {
    const decoded = jwt.decode(token);
    if (typeof decoded === 'object' && decoded !== null) {
      // Set to a far future date (100 years from now) if no expiration
      const expiredAt =
        'exp' in decoded
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      console.log(expiredAt);
      return await this.prisma.token.create({
        data: { token, expiredAt },
      });
    }
    throw new Error('Invalid token');
  }

  // private async createUser(
  //   createAuthDto: RegisterDto,
  //   hashedPassword: string,
  //   data: any,
  //   avatar?: string,
  // ) {
  //   const {
  //     branchId,
  //     role: roles = 'user',
  //     firstName,
  //     lastName,
  //     phone,
  //   } = createAuthDto;
  //   const role = roles.toUpperCase() as Role;

  //   if (branchId) {
  //     const isBranchExist = await this.prisma.branch.findUnique({
  //       where: { id: branchId },
  //     });
  //     if (!isBranchExist) throw new NotFoundException('Branch not found');
  //   }

  //   try {
  //     return this.prisma.$transaction(async (prisma) => {
  //       const user = await prisma.user.create({
  //         data: {
  //           firstName,
  //           lastName,
  //           phone,
  //           role,
  //           password: hashedPassword,
  //           ...(avatar && { avatar: avatar }),
  //         },
  //       });

  //       return await prisma.user.update({
  //         where: { id: user.id },
  //         data: {
  //           ...data,
  //           ...(avatar && { avatar: avatar }),
  //         },
  //         omit: { password: true },
  //         include: {
  //           barber: { include: { Slot: true } },
  //         },
  //       });
  //     });
  //   } catch (error) {
  //     throw new BadRequestException('Failed to create user', error.message);
  //   }
  // }

  public async generateToken(userId: string) {
    const token = jwt.sign({ userId }, this.jwtSecret);
    await this.loginToken(token);
    return token;
  }

  public async checkReferralCode(
    referralCode: string,
  ): Promise<{ status: boolean; user: Client }> {
    const isReferralCodeExist = await this.prisma.client.findFirst({
      where: { referralCode },
    });
    if (!isReferralCodeExist) return { status: false, user: null };
    return { status: true, user: isReferralCodeExist };
  }

  public async changePassword(id: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: id },
    });
    if (!user) throw new NotFoundException('User not found');
    const hashedPassword = await hash(password, 10);
    try {
      await this.prisma.user.update({
        where: { id: id },
        data: { password: hashedPassword },
        omit: { password: true },
      });

      // Invalidate all tokens for this user (log out from all devices)
      await this.invalidateAllUserTokens(id);

      return new AppSuccess(null, 'Password changed successfully');
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to change password');
    }
  }

  public async resetPassword(phone: string) {
    const password = DEFAULT_PASSWORD;
    const user = await this.prisma.user.findUnique({
      where: {
        phone: phone,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.role?.toUpperCase() === Role.ADMIN) {
      throw new BadRequestException('Admin cannot reset password');
    }
    const hashedPassword = await hash(password, 10);

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
        omit: { password: true },
      });

      // Invalidate all tokens for this user (log out from all devices)
      await this.invalidateAllUserTokens(user.id);

      return new AppSuccess(user, 'Password reset successfully');
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Failed to reset password');
    }
  }

  async generateSlots(start: number, end: number) {
    const duration = (await this.prisma.settings.findFirst({})).slotDuration;

    if (!Number.isInteger(start) || !Number.isInteger(end))
      throw new BadRequestException(
        'Start and end must not be decimal, negative or string.',
      );

    if (start < 0 || start >= 24 || end < 0 || end > 24) {
      throw new BadRequestException(
        'Start and end must be Integer numbers between 0 and 24.',
      );
    }

    const slotsArray: string[] = [];

    // Handle case where time spans across midnight (e.g., start: 14, end: 0)
    if (start >= end) {
      // From start to end of day (24:00)
      for (let time = start * 60; time < 24 * 60; time += duration) {
        const hour = Math.floor(time / 60);
        const minute = time % 60;
        const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')} ${period}`;
        slotsArray.push(slot);
      }

      // From start of day (00:00) to end - only if end > 0
      if (end > 0) {
        for (let time = 0; time < end * 60; time += duration) {
          const hour = Math.floor(time / 60);
          const minute = time % 60;
          const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          const period = hour >= 12 ? 'PM' : 'AM';
          const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
            .toString()
            .padStart(2, '0')} ${period}`;
          slotsArray.push(slot);
        }
      }
    } else {
      // Normal case where start < end
      for (let time = start * 60; time < end * 60; time += duration) {
        const hour = Math.floor(time / 60);
        const minute = time % 60;
        const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')} ${period}`;
        slotsArray.push(slot);
      }
    }

    return slotsArray;
  }
}
