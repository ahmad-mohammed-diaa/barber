import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class CreateUserService {
  private readonly logger = new Logger(CreateUserService.name);
  constructor() {}
  public async create(
    tx: Prisma.TransactionClient,
    userData: Prisma.UserCreateInput,
    RoleData: any,
    role: Role,
  ) {
    const { phone } = userData;
    // await this.userExistsService.findUserByPhone(userData.phone);
    const user = await tx.user.findUnique({ where: { phone } });
    if (user) throw new BadRequestException('User already exists');

    try {
      const user = await tx.user.create({ data: { ...userData, role } });

      return await tx.user.update({
        where: { id: user.id },
        data: RoleData,
        omit: { password: true },
      });
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
}
