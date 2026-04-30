import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { hash } from 'bcrypt';
import { Role, User } from '@prisma/client';
import { RegisterDto } from '../dto/auth-register-dto';
import { Random } from '../../../common/utils/generate';
import { AuthSlotService } from './auth-slot.service';
import { CreateUserService } from './create-user.service';
import { ReferralCodeService } from './referral-code.service';
import { TokenOperationsService } from './token-operations.service';

@Injectable()
export class AuthSignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSlot: AuthSlotService,
    private readonly createUser: CreateUserService,
    private readonly authReferral: ReferralCodeService,
    private readonly tokenOps: TokenOperationsService,
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
    const isRole = (r: Role) => Role[ROLE] === r;

    if (isRole(Role.BARBER) || isRole(Role.CASHIER)) {
      slot = await this.authSlot.isBranchExistCreateSlot(branchId, start, end);
    }

    const userData = {
      firstName,
      lastName,
      phone,
      password: await hash(password, 10),
      ...(file?.path && { avatar: file.path }),
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
    const adminData = { admin: { create: {} } };

    try {
      switch (ROLE) {
        case Role.ADMIN:
          user = await this.createUser.create(
            this.prisma,
            userData,
            adminData,
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

      const token = await this.tokenOps.generateToken(user.id);

      return {
        data: user,
        ...(ROLE === Role.USER && { token }),
        message: 'User registered successfully',
        statusCode: 201,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to register user';
      throw new InternalServerErrorException(err, errorMessage);
    }
  }
}
