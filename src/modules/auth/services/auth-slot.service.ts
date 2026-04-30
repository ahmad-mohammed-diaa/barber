import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { generateSlots } from '../../../common/utils/generateSlot';

@Injectable()
export class AuthSlotService {
  private readonly logger = new Logger(AuthSlotService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async isBranchExistCreateSlot(
    branchId: string,
    start: number,
    end: number,
  ): Promise<string[]> {
    try {
      const isBranchExist = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!isBranchExist)
        throw new BadRequestException('Branch with this ID does not exist');

      return await generateSlots(this.prisma, start, end);
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Error occurred while creating slots');
    }
  }

  public async generateSlots(start: number, end: number): Promise<string[]> {
    return generateSlots(this.prisma, start, end);
  }
}
