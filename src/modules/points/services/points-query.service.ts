import { Injectable } from '@nestjs/common';
import { Language } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import { Translation } from '../../../common/class-type/translation';

@Injectable()
export class PointsQueryService {
  constructor(private prisma: PrismaService) {}

  async findAll(language: Language) {
    const fetchedPoints = await this.prisma.points.findMany({
      include: Translation(true, language),
    });

    const points = fetchedPoints.map((point) => {
      const { Translation: trans, ...rest } = point;
      return {
        ...rest,
        Translation: trans,
        name: trans[0]?.name,
      };
    });

    return new AppSuccess({ points }, 'Points fetched successfully');
  }

  async findOne(id: string, lang: Language) {
    if (!id) {
      return new AppSuccess(null, 'Point not found');
    }

    const fetchedPoint = await this.prisma.points.findUnique({
      where: {
        id: id,
      },
      include: Translation(true, lang),
    });

    const { Translation: translation, ...rest } = fetchedPoint;
    const point = {
      ...rest,
      name: translation[0]?.name,
    };

    return new AppSuccess(point, 'Point fetched successfully');
  }
}
