import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryType, Language } from '@prisma/client';
import {
  createTranslation,
  Translation,
  updateTranslation,
} from '../../class-type/translation';
import { getTranslationNames } from '@/common/lib/lib';

@Injectable()
export class BranchService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBranchDto, file: Express.Multer.File) {
    const { latitude, longitude } = dto;
    const branchImg = file?.path;

    const newBranch = await this.prisma.branch.create({
      data: {
        ...dto,
        latitude,
        longitude,
        Translation: createTranslation(dto),
        ...(branchImg && { branchImg }),
      },
      include: Translation(),
    });

    const { Translation: t, ...rest } = newBranch;
    return { name: t[0].name, ...rest };
  }

  async findAll(language: Language) {
    const fetchBranches = await this.prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { ...Translation(), barber: true },
    });

    const maxDaysBooking = await this.prisma.settings
      .findFirst()
      .then((s) => s?.maxDaysBooking);

    const branches = fetchBranches.map((branch) => {
      const { Translation, ...rest } = branch;
      return {
        ...rest,
        ...getTranslationNames(Translation, language),
        maxDaysBooking,
      };
    });

    return { branches };
  }

  async findOne(id: string, type?: CategoryType, language?: Language) {
    const [branch, maxDaysBooking] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id },
        include: {
          ...Translation(false, language),
          barber: {
            where: { type },
            select: {
              id: true,
              rate: true,
              type: true,
              user: {
                select: {
                  id: false,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  avatar: true,
                },
              },
            },
          },
          Cashier: {
            select: {
              id: true,
              user: {
                select: {
                  id: false,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.settings.findFirst().then((s) => s?.maxDaysBooking),
    ]);
    if (!branch) throw new NotFoundException(`Branch with ID ${id} not found`);

    const { Translation: t, ...rest } = branch;

    return {
      ...rest,
      name: t[0].name,
      maxDaysBooking,
    };
  }

  async update(id: string, dto: UpdateBranchDto, file: Express.Multer.File) {
    await this.findOne(id);

    const branchImg = file?.path;

    return this.prisma.branch.update({
      where: { id },
      data: {
        ...dto,
        ...(branchImg && { branchImg }),
        Translation: updateTranslation(dto),
      },
    });
  }

  async remove(id: string) {
    return `This action removes a #${id} branch`;
  }
}
