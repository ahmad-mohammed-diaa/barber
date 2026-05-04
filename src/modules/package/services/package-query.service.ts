import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import { Translation } from '../../../common/class-type/translation';
import { Language } from '@prisma/client';
import { getTranslationNames } from '@/common/lib/lib';

@Injectable()
export class PackageQueryService {
  constructor(private prisma: PrismaService) {}

  async findAll(language: Language) {
    const fetchedPackages = await this.prisma.offers.findMany({
      where: { offerType: 'PACKAGES', NOT: { packages: null } },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        packages: {
          include: {
            ...Translation(),
            services: {
              include: {
                ...Translation(),
              },
            },
          },
        },
      },
    });
    const packages = fetchedPackages.map((packageData) => {
      const {
        createdAt,
        updatedAt,
        id,
        packages: {
          Translation: packageTranslation,
          services: s,
          price,
          count,
        },
      } = packageData;
      const services = s.map((s) => {
        const { Translation: serviceTranslation, ...rest } = s;
        return {
          ...rest,
          ...getTranslationNames(serviceTranslation, language),
        };
      });
      return {
        id,
        price,
        count,
        ...getTranslationNames(packageTranslation, language),
        description: packageTranslation.find((t) => t.language === language)
          ?.description,
        createdAt,
        updatedAt,
        services,
      };
    });

    return new AppSuccess({ packages }, 'packages fetched successfully', 200);
  }

  async findOne(id: string, language: Language) {
    const fetchedPackage = await this.prisma.packages.findUnique({
      where: { id },
      include: {
        ...Translation(false, language),
        services: {
          select: {
            id: true,
            ...Translation(false, language),
            serviceImg: true,
          },
        },
      },
    });

    if (!fetchedPackage) new NotFoundException('Package not found');

    const { Translation: t, services: s, ...rest } = fetchedPackage;
    const services = s.map((s) => {
      const { Translation, ...rest } = s;
      return {
        ...rest,
        name: Translation[0].name,
      };
    });

    const packageData = {
      ...rest,
      name: t[0].name,
      services,
    };

    return new AppSuccess(packageData, 'Package fetched successfully');
  }
}
