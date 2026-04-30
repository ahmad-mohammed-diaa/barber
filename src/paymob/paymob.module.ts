import { Module } from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymobController } from './paymob.controller';
import { ClientPackagesQueryService } from '@/modules/client-packages/services/client-packages-query.service';
import { PointsMutationService } from '@/modules/points/services/points-mutation.service';

@Module({
  controllers: [PaymobController],
  providers: [PaymobService, ClientPackagesQueryService, PointsMutationService],
})
export class PaymobModule {}
