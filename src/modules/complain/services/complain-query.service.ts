import { Injectable, NotFoundException } from '@nestjs/common';
import { Complain } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';

@Injectable()
export class ComplainQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllComplains(): Promise<AppSuccess<{ complains: Complain[] }>> {
    const complains = await this.prisma.complain.findMany({
      include: {
        client: {
          select: {
            user: {
              select: {
                id: false,
                firstName: true,
                lastName: true,
                avatar: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return new AppSuccess({ complains }, 'Complains found successfully');
  }

  async findOne(id: string): Promise<AppSuccess<Complain>> {
    const complain = await this.prisma.complain.findUnique({
      where: {
        id,
      },
      include: {
        client: {
          select: {
            user: {
              select: {
                id: false,
                firstName: true,
                lastName: true,
                avatar: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!complain) throw new NotFoundException('Complain not found');

    return new AppSuccess(complain, 'Complain found successfully');
  }
}
