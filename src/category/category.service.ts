import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AppSuccess } from 'src/utils/AppSuccess';
import { Category, CategoryType, Language, User } from '@prisma/client';
import {
  createTranslation,
  Translation,
  updateTranslation,
} from '../../src/class-type/translation';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  public async findAllCategories(
    user: User,
    language: Language,
    type: CategoryType,
  ) {
    // Use Promise.all to run queries in parallel instead of sequentially
    const [fetchedCategories, packages] = await Promise.all([
      // Optimized category query - only fetch specific language translations
      this.prisma.category.findMany({
        where: { type, available: true },
        include: {
          services: {
            where: { available: true },
            include: {
              Translation: {
                where: { language: { in: ['EN', 'AR', language] } },
                select: {
                  name: true,
                  language: true,
                },
              },
            },
          },
          Translation: {
            where: { language: { in: ['EN', 'AR', language] } },
            select: {
              name: true,
              language: true,
            },
          },
        },
      }),

      // Only fetch user packages if user exists and is a USER role
      user && user.role === 'USER'
        ? this.getUserPackages(user.id, language)
        : null,
    ]);

    // Optimize data transformation using Maps for O(1) lookups instead of O(n) finds
    const categories = fetchedCategories.map((category) => {
      const { Translation: categoryTranslation, services, ...rest } = category;

      // Create translation map for fast lookups
      const categoryTransMap = new Map(
        categoryTranslation.map((t) => [t.language, t.name]),
      );

      const optimizedServices = services.map((service) => {
        const { Translation: serviceTranslation, ...serviceRest } = service;

        // Create translation map for fast lookups
        const serviceTransMap = new Map(
          serviceTranslation.map((t) => [t.language, t.name]),
        );

        return {
          ...serviceRest,
          nameEN: serviceTransMap.get('EN'),
          nameAR: serviceTransMap.get('AR'),
          name: serviceTransMap.get(language),
        };
      });

      return {
        ...rest,
        nameEN: categoryTransMap.get('EN'),
        nameAR: categoryTransMap.get('AR'),
        name: categoryTransMap.get(language),
        services: optimizedServices,
      };
    });

    return new AppSuccess(
      { categories, ...(packages?.length && { package: packages }) },
      'Categories found successfully',
    );
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
                Translation: {
                  where: { language },
                  select: {
                    name: true,
                    description: true,
                  },
                },
                packageService: {
                  select: {
                    service: true,
                  },
                },
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

  public async findCategoryById(
    id: string,
    language: Language,
  ): Promise<AppSuccess<Category>> {
    const category = await this.findOneOrFail(id, language);

    return new AppSuccess(category, 'Category found successfully');
  }

  public async createCategory(
    createCategoryDto: CreateCategoryDto,
    language: Language,
  ): Promise<AppSuccess<Category>> {
    const newCategory = await this.prisma.category.create({
      data: {
        ...createCategoryDto,
        Translation: createTranslation(createCategoryDto),
      },
      include: Translation(false, language),
    });

    const { Translation: categoryTranslation, ...rest } = newCategory;

    const category = {
      ...rest,
      name: categoryTranslation[0].name,
    };

    return new AppSuccess(category, 'Category created successfully');
  }

  public async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    language: Language,
  ): Promise<AppSuccess<Category>> {
    await this.findOneOrFail(id);

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: {
        ...updateCategoryDto,
        Translation: updateTranslation(updateCategoryDto),
      },
      include: Translation(false, language),
    });

    const { Translation: categoryTranslation, ...rest } = updatedCategory;

    const category = {
      ...rest,
      name: categoryTranslation[0].name,
    };

    return new AppSuccess(category, 'Category updated successfully');
  }

  public async delete(id: string): Promise<AppSuccess<Category>> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if any services in this category are used in orders
    const servicesWithOrders = category.services.filter(
      (service) => service.order.length > 0,
    );

    if (servicesWithOrders.length > 0) {
      throw new ConflictException(
        `Cannot delete category. It has ${servicesWithOrders.length} service(s) that are already used in orders.`,
      );
    }

    const deleteCategory = await this.prisma.category.delete({
      where: { id },
    });

    return new AppSuccess(deleteCategory, 'Category deleted successfully');
  }

  private async findOneOrFail(id: string, language?: Language) {
    const fetchedCategory = await this.prisma.category.findUnique({
      where: { id },
      include: {
        services: {
          include: Translation(false, language),
        },
        ...Translation(false, language),
      },
    });

    const {
      Translation: categoryTranslation,
      services,
      ...rest
    } = fetchedCategory;

    const service = services.map((service) => {
      const { Translation: serviceTranslation, ...rest } = service;
      return {
        ...rest,
        name: serviceTranslation[0].name,
      };
    });

    const category = {
      ...rest,
      services: service,
      name: categoryTranslation[0].name,
    };

    if (!category) throw new NotFoundException('Category not found');

    return category;
  }
}
