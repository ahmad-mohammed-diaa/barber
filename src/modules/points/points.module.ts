import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { PointsQueryService } from './services/points-query.service';
import { PointsMutationService } from './services/points-mutation.service';

@Module({
  controllers: [PointsController],
  providers: [PointsService, PointsQueryService, PointsMutationService],
  exports: [PointsQueryService],
})
export class PointsModule {}
