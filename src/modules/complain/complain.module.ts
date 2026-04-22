import { Module } from '@nestjs/common';
import { ComplainService } from './complain.service';
import { ComplainController } from './complain.controller';
import { ComplainQueryService } from './services/complain-query.service';
import { ComplainMutationService } from './services/complain-mutation.service';

@Module({
  controllers: [ComplainController],
  providers: [
    ComplainService,
    ComplainQueryService,
    ComplainMutationService,
  ],
  exports: [ComplainService],
})
export class ComplainModule {}
