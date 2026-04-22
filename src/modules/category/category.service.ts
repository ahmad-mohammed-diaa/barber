import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryType, Language, User } from '@prisma/client';
import {
  createTranslation,
  Translation,
  updateTranslation,
} from '../../class-type/translation';
import { getTranslationNames } from '@/common/lib/lib';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  public async findAllCategories(
    user: User,
    language: Language,
    type: CategoryType,
  ) {
    const [fetchedCategories, packages] = await Promise.all([
      this.prisma.category.findMany({
        where: { type, available: true },
        include: {
          Translation: true,
          services: {
            include: { Translation: true },
            where: { available: true },
          },
        },
      }),
      user && user.role === 'USER'
        ? this.getUserPackages(user.id, language)
        : null,
    ]);

    const categories = fetchedCategories.map((category) => {
      const {
        Translation: categoryTranslation,
        services: categoryServices,
        ...rest
      } = category;

      const services = categoryServices.map((service) => {
        const { Translation: serviceTranslation, ...serviceRest } = service;
        return {
          ...serviceRest,
          ...getTranslationNames(serviceTranslation, language),
        };
      });

      return {
        ...getTranslationNames(categoryTranslation, language),
        ...rest,
        services,
      };
    });

    return { categories, ...(packages && { package: packages }) };
  }

  private async getUserPackages(userId: string, language: Language) {
    const userWithPackages = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        client: {
          select: {
            ClientPackages: {
              where: { isActive: true, type: 'MULTIPLE' },
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                type: true,
                Translation: { where: { language } },
                packageService: { select: { service: true } },
              },
            },
          },
        },
      },
    });

    if (!userWithPackages?.client?.ClientPackages) return [];

    return userWithPackages.client.ClientPackages.flatMap((item) =>
      item.Translation.map((translate) => ({
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        type: item.type,
        name: translate.name,
        description: translate.description,
        services: item.packageService.flatMap((service) => service.service),
      })),
    );
  }

  public async findCategoryById(id: string, language: Language) {
    return this.findOneOrFail(id, language);
  }

  public async createCategory(dto: CreateCategoryDto, language: Language) {
    const newCategory = await this.prisma.category.create({
      data: { ...dto, Translation: createTranslation(dto) },
      include: Translation(false, language),
    });

    const { Translation: t, id, ...rest } = newCategory;

    return {
      id,
      name: t[0].name,
      ...rest,
    };
  }

  public async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    language: Language,
  ) {
    await this.findOneOrFail(id);

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: { ...dto, Translation: updateTranslation(dto) },
      include: Translation(false, language),
    });

    const { Translation: categoryTranslation, ...rest } = updatedCategory;

    return {
      ...rest,
      name: categoryTranslation[0].name,
    };
  }

  public async delete(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { services: { include: { order: true } } },
    });

    if (!category) throw new NotFoundException('Category not found');

    const servicesWithOrders = category.services.filter(
      (service) => service.order.length > 0,
    );

    if (servicesWithOrders.length > 0) {
      throw new ConflictException(
        `Cannot delete category. It has ${servicesWithOrders.length} service(s) that are already used in orders.`,
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  private async findOneOrFail(id: string, language?: Language) {
    const fetchedCategory = await this.prisma.category.findUnique({
      where: { id },
      include: {
        services: { include: Translation(false, language) },
        ...Translation(false, language),
      },
    });

    if (!fetchedCategory) throw new NotFoundException('Category not found');

    const {
      Translation: categoryTranslation,
      services,
      ...rest
    } = fetchedCategory;

    const service = services.map((s) => {
      const { Translation: serviceTranslation, ...sRest } = s;
      return { ...sRest, name: serviceTranslation[0].name };
    });

    return {
      ...rest,
      services: service,
      name: categoryTranslation[0].name,
    };
  }
}
