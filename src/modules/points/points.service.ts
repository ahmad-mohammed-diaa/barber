import { Injectable } from '@nestjs/common';
import { Language, User } from '@prisma/client';
import { PointsQueryService } from './services/points-query.service';
import { PointsMutationService } from './services/points-mutation.service';
import { CreatePointDto } from './dto/create-point.dto';
import { UpdatePointDto } from './dto/update-point.dto';

@Injectable()
export class PointsService {
  constructor(
    private readonly pointsQuery: PointsQueryService,
    private readonly pointsMutation: PointsMutationService,
  ) {}

  create(offerId: string, user: User, lang: Language) {
    return this.pointsMutation.create(offerId, user, lang);
  }

  createPoints(createPointDto: CreatePointDto, file: Express.Multer.File) {
    return this.pointsMutation.createPoints(createPointDto, file);
  }

  purchasePoint(user: User, pointId: string) {
    return this.pointsMutation.purchasePoint(user, pointId);
  }

  findAll(language: Language) {
    return this.pointsQuery.findAll(language);
  }

  findOne(id: string, lang: Language) {
    return this.pointsQuery.findOne(id, lang);
  }

  update(id: string, updatePointDto: UpdatePointDto, lang: Language) {
    return this.pointsMutation.update(id, updatePointDto, lang);
  }

  remove(id: number) {
    return this.pointsMutation.remove(id);
  }
}
