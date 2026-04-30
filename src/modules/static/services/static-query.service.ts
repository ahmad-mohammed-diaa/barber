import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';

@Injectable()
export class StaticQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatic() {
    return new AppSuccess(
      await this.prisma.static.findFirst({
        include: { about: true, questions: true },
      }),
      'Static data retrieved successfully',
    );
  }

  async ensureStaticExists(id: string) {
    const exists = await this.prisma.static.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Static not found');
  }
}
