import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AppSuccess } from 'src/utils/AppSuccess';
import { Translation } from 'src/class-type/translation';
import { Language } from '@prisma/client';

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
        packages: { Translation: packageTrans, services: s, price, count },
      } = packageData;
      const services = s.map((s) => {
        const { Translation: serviceTrans, ...rest } = s;
        return {
          ...rest,
          nameEN: serviceTrans.find((t) => t.language === 'EN')?.name,
          nameAR: serviceTrans.find((t) => t.language === 'AR')?.name,
          name: serviceTrans.find((t) => t.language === language)?.name,
        };
      });
      return {
        id,
        price,
        count,
        nameEN: packageTrans.find((t) => t.language === 'EN')?.name,
        nameAR: packageTrans.find((t) => t.language === 'AR')?.name,
        name: packageTrans.find((t) => t.language === language)?.name,
        description: packageTrans.find((t) => t.language === language)
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
