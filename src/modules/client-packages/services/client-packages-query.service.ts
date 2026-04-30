import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Language } from '@prisma/client';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import { Translation } from '../../../common/class-type/translation';

@Injectable()
export class ClientPackagesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(language: Language) {
    const fetchedClientPackages = await this.prisma.clientPackages.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        Translation: {
          where: { language },
          ...Translation().Translation,
        },
        packageService: {
          include: {
            service: {
              include: {
                Translation: {
                  ...Translation().Translation,
                },
              },
            },
          },
        },
      },
    });

    const clientPackages = fetchedClientPackages.map((clientPackage) => {
      const { Translation, packageService, ...rest } = clientPackage;
      return {
        ...rest,
        nameEN: Translation.find((t) => t.language === 'EN')?.name,
        nameAR: Translation.find((t) => t.language === 'AR')?.name,
        name: Translation.find((t) => t.language === language)?.name,
        description: Translation.find((t) => t.language === language)
          .description,
        services: packageService.map((service) => {
          const { serviceImg, Translation, ...rest } = service.service;
          return {
            ...rest,
            nameEN: Translation.find((t) => t.language === 'EN')?.name,
            nameAR: Translation.find((t) => t.language === 'AR')?.name,
            name: Translation.find((t) => t.language === language)?.name,
            serviceImg,
          };
        }),
      };
    });

    return new AppSuccess(
      { clientPackages },
      'Client packages fetched successfully',
      200,
    );
  }

  async findOne(id: string, language: Language) {
    const fetchedClientPackage = await this.prisma.clientPackages.findUnique({
      where: { id: id },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ...Translation(true, language),
        packageService: {
          include: {
            service: {
              select: {
                id: true,
                ...Translation(true, language),
                serviceImg: true,
              },
            },
          },
        },
      },
    });

    const {
      Translation: clientPackageTranslation,
      packageService,
      ...rest
    } = fetchedClientPackage;

    const clientPackage = {
      ...rest,
      name: clientPackageTranslation[0].name,
      description: clientPackageTranslation[0].description,
      Translation: clientPackageTranslation,
      services: packageService.map((service) => {
        const { serviceImg, Translation, ...rest } = service.service;
        return {
          ...rest,
          name: Translation[0].name,
          serviceImg,
        };
      }),
    };

    if (!clientPackage) {
      throw new NotFoundException(`Client package with ID ${id} not found`);
    }

    return new AppSuccess(
      { clientPackage },
      'Client package fetched successfully',
      200,
    );
  }
}
