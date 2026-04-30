import { Injectable, NotFoundException } from '@nestjs/common';
import { Language, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import {
  createTranslation,
  Translation,
} from '../../../common/class-type/translation';
import { CreatePointDto } from '../dto/create-point.dto';
import { UpdatePointDto } from '../dto/update-point.dto';

@Injectable()
export class PointsMutationService {
  constructor(private prisma: PrismaService) {}

  async create(offerId: string, user: User, lang: Language) {
    const offers = await this.prisma.offers.findUnique({
      where: {
        id: offerId,
      },
      select: {
        offerType: true,
        points: {
          select: {
            ...Translation(true, lang),
            price: true,
            points: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const updateUser = await this.prisma.client.update({
      where: {
        id: user.id,
      },
      data: {
        points: { increment: offers.points.points },
      },
    });
    return new AppSuccess(updateUser, 'Points added successfully');
  }

  async createPoints(
    createPointDto: CreatePointDto,
    file: Express.Multer.File,
  ) {
    const { price, points } = createPointDto;

    const offer = await this.prisma.offers.create({
      data: {
        offerType: 'POINTS',
        expiresAt: new Date(),
      },
    });

    const updatePoint = await this.prisma.offers.update({
      where: { id: offer.id },
      data: {
        points: {
          create: {
            Translation: createTranslation(createPointDto),
            price,
            points,
            expiresAt: new Date(),
            image: file?.path,
          },
        },
      },
      include: {
        points: { include: { Translation: true } },
      },
    });

    const {
      points: { Translation: trans },
      ...rest
    } = updatePoint;

    const point = {
      ...rest,
      name: trans[0]?.name,
    };

    return new AppSuccess(point, 'Point created successfully');
  }

  async purchasePoint(user: User, pointId: string) {
    const client = await this.prisma.client.findUnique({
      where: {
        id: user.id,
      },
    });

    if (!client) {
      return new AppSuccess(null, 'client not found');
    }

    const point = await this.prisma.points.findUnique({
      where: {
        id: pointId,
      },
    });

    if (!point) {
      return new AppSuccess(null, 'Point not found');
    }

    const clientPoint = await this.prisma.client.update({
      where: {
        id: user.id,
      },
      data: {
        points: {
          increment: point.points,
        },
      },
    });

    return new AppSuccess(clientPoint, 'Point purchased successfully');
  }

  update(id: string, _updatePointDto: UpdatePointDto, _lang: Language) {
    return `This action updates a #${id} point`;
  }

  remove(id: number) {
    return `This action removes a #${id} point`;
  }
}
