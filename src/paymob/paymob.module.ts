import { Module } from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymobController } from './paymob.controller';
import { ClientPackagesService } from '../modules/client-packages/client-packages.service';
import { PointsService } from '../modules/points/points.service';

@Module({
  controllers: [PaymobController],
  providers: [PaymobService, ClientPackagesService, PointsService],
})
export class PaymobModule {}
