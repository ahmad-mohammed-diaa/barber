import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Language } from '@prisma/client';
import { AppSuccess } from 'src/utils/AppSuccess';
import {
  createTranslation,
  Translation,
  translationDes,
} from 'src/class-type/translation';

@Injectable()
export class ClientPackagesMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(packageId: string, phone: string, language: Language) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user)
      throw new NotFoundException(`User with phone ${phone} not found`);

    const pkg = await this.prisma.packages.findFirst({
      where: { id: packageId },
      include: { services: true, ...translationDes() },
    });

    if (!pkg) {
      throw new NotFoundException(`the Package you choose not found`);
    }

    const clientPackageExists = await this.prisma.clientPackages.findFirst({
      where: { packageId: pkg.id, clientId: user.id },
    });

    if (clientPackageExists) {
      throw new NotFoundException('You already have this package');
    }

    const clientPackage = await this.prisma.client.update({
      where: { id: user.id },
      data: {
        ClientPackages: {
          create: {
            Translation: createTranslation(pkg),
            packageId: pkg.id,
            type: pkg.type,
            packageService: {
              createMany: {
                data: pkg.services.map((service) => ({
                  serviceId: service.id,
                  remainingCount: pkg.count,
                })),
              },
            },
          },
        },
      },
      include: {
        ClientPackages: {
          select: {
            id: true,
            packageService: {
              include: {
                service: {
                  include: Translation(false, language),
                },
              },
            },
          },
        },
      },
    });

    return new AppSuccess(
      clientPackage,
      'Client package created successfully',
      201,
    );
  }

  update(id: number) {
    return `This action updates a #${id} clientPackage`;
  }

  async remove(id: string) {
    await this.prisma.$transaction(async (prisma) => {
      await prisma.packagesServices.deleteMany({
        where: { ClientPackagesId: id },
      });

      await prisma.clientPackages.delete({
        where: { id },
      });

      return 'deleted';
    });
  }
}
