import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePackageDto } from '../dto/create-package.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AppSuccess } from 'src/utils/AppSuccess';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createTranslation } from 'src/class-type/translation';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class PackageMutationService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  async create(createPackageDto: CreatePackageDto, file: Express.Multer.File) {
    const { serviceIds, type, count, ...rest } = createPackageDto;

    const existingServiceIds = (
      await this.prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true },
      })
    ).map((service) => service.id);

    const invalidServiceIds = serviceIds.filter(
      (serviceId) => !existingServiceIds.includes(serviceId),
    );

    if (invalidServiceIds.length > 0) {
      throw new BadRequestException(
        `Invalid service IDs: ${invalidServiceIds.join(', ')}`,
      );
    }

    if (type === 'MULTIPLE' && count > 1) {
      throw new BadRequestException(
        'Count of services must be 1 for type MULTIPLE',
      );
    }

    const image = file?.path;
    const offer = await this.prisma.offers.create({
      data: {
        offerType: 'PACKAGES',
        expiresAt: rest.expiresAt,
        packages: {
          create: {
            ...rest,
            type,
            count,
            services: { connect: serviceIds.map((id) => ({ id })) },
            ...(image && { image }),
            Translation: createTranslation(createPackageDto),
          },
        },
      },
    });

    const send = await this.notification.sendNotificationToAllUsers({
      title: 'New Package added',
      message: `A new package has been added: ${rest.Translation.find((t) => t.language === 'EN').name}`,
    });
    console.log(send);
    return new AppSuccess(offer, 'Package created successfully', 201);
  }

  update(id: string) {
    return `This action updates a #${id} package`;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredPackages() {
    const result = await this.prisma.packages.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const resultOffer = await this.prisma.packages.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.length > 0 || resultOffer.length > 0) {
      await this.prisma.packages.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      await this.prisma.offers.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    }
  }

  async remove() {
    await this.prisma.packages.deleteMany();

    return `This action removes a package`;
  }
}
