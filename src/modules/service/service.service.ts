import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Language } from '@prisma/client';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceStatusDto } from './dto/service-status.dto';
import {
  createTranslation,
  Translation as serviceTranslation,
  updateTranslation,
} from '../../class-type/translation';
import { getTranslationNames } from '@/common/lib/lib';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  public async getAllService(language: Language) {
    const fetchedServices = await this.prisma.service.findMany({
      where: { available: true },
      include: serviceTranslation(),
    });

    const services = fetchedServices.map((service) => {
      const { Translation, ...rest } = service;
      return {
        ...rest,
        ...getTranslationNames(Translation, language),
      };
    });

    return { services };
  }

  public async getServiceById(id: string, language: Language) {
    return this.findOneOrFail(id, language);
  }

  public async createService(
    dto: CreateServiceDto,
    file: Express.Multer.File,
    language: Language,
  ) {
    const serviceImg = file?.path;

    const newService = await this.prisma.service.create({
      data: {
        ...dto,
        ...(serviceImg && { serviceImg }),
        Translation: createTranslation(dto),
      },
      include: serviceTranslation(false),
    });

    const { Translation, ...rest } = newService;

    return {
      ...rest,
      ...getTranslationNames(Translation, language),
    };
  }

  public async updateService(
    id: string,
    dto: UpdateServiceDto,
    file: Express.Multer.File,
    language: Language,
  ) {
    await this.findOneOrFail(id);
    const serviceImg = file?.path;

    const updatedService = await this.prisma.service.update({
      where: { id },
      data: {
        ...dto,
        ...(serviceImg && { serviceImg }),
        Translation: updateTranslation(dto),
      },
      include: serviceTranslation(false),
    });

    const { Translation, ...rest } = updatedService;

    return {
      ...rest,
      ...getTranslationNames(Translation, language),
    };
  }

  public async softDeleteService(id: string, dto: ServiceStatusDto) {
    await this.findOneOrFail(id);
    const service = await this.prisma.service.update({
      where: { id },
      data: { available: dto.available },
    });

    return service;
  }

  private async findOneOrFail(id: string, language?: Language) {
    const service = await this.prisma.service.findUnique({
      where: { id, available: true },
      include: serviceTranslation(false),
    });
    if (!service) throw new NotFoundException('Service not found');

    const { Translation, ...rest } = service;

    return {
      ...rest,
      ...getTranslationNames(Translation, language),
    };
  }
}
