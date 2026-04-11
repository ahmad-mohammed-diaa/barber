import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PromoCodeService } from 'src/promo-code/promo-code.service';
import { NotificationService } from 'src/notification/notification.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PromoCodeService, NotificationService],
})
export class OrderModule {}
