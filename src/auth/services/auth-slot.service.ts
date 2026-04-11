import {
  BadRequestException,
  Global,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlots } from '../../utils/generateSlot';

@Injectable()
export class AuthSlotService {
  private readonly logger = new Logger(AuthSlotService.name);
  constructor(private prisma: PrismaService) {}

  public async isBranchExistCreateSlot(
    branchId: string,
    start: number,
    end: number,
  ) {
    try {
      const isBranchExist = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!isBranchExist)
        throw new BadRequestException('Branch with this ID does not exist');

      return await generateSlots(this.prisma, start, end);
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Error occurred while creating slots');
    }
  }
}
