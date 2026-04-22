import { Module } from '@nestjs/common';
import { StaticService } from './static.service';
import { StaticController } from './static.controller';
import { StaticQueryService } from './services/static-query.service';
import { StaticMutationService } from './services/static-mutation.service';

@Module({
  controllers: [StaticController],
  providers: [StaticService, StaticQueryService, StaticMutationService],
  exports: [StaticService],
})
export class StaticModule {}
