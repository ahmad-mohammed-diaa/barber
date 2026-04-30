import { Injectable, NotFoundException } from '@nestjs/common';
import { Complain, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateComplainDto } from '../dto/create-complain.dto';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import { ComplainQueryService } from './complain-query.service';

@Injectable()
export class ComplainMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly complainQuery: ComplainQueryService,
  ) {}

  async createComplain(
    createComplainDto: CreateComplainDto,
    user: User,
  ): Promise<AppSuccess<Complain>> {
    const complain = await this.prisma.complain.create({
      data: {
        ...createComplainDto,
        client: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    return new AppSuccess(complain, 'Complain created successfully');
  }

  async updateComplain(id: string) {
    await this.complainQuery.findOne(id);

    const updatedComplain = await this.prisma.complain.update({
      where: { id },
      data: {
        done: true,
      },
    });

    return new AppSuccess(updatedComplain, 'Complain updated successfully');
  }

  async remove(id: string): Promise<AppSuccess<Complain>> {
    const complain = await this.prisma.complain.findUnique({
      where: { id },
    });

    if (!complain) throw new NotFoundException('Complain not found');

    return new AppSuccess(
      await this.prisma.complain.delete({
        where: {
          id,
        },
      }),
      'Complain deleted successfully',
    );
  }
}
