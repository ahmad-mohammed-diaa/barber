import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderQueryService } from './services/order-query.service';
import { OrderListingService } from './services/order-listing.service';
import { OrderPricingService } from './services/order-pricing.service';
import { OrderBookingService } from './services/order-booking.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderMutationService } from './services/order-mutation.service';
import { PromoCodeModule } from '../promo-code/promo-code.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PromoCodeModule, NotificationModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderQueryService,
    OrderListingService,
    OrderPricingService,
    OrderBookingService,
    OrderLifecycleService,
    OrderMutationService,
  ],
})
export class OrderModule {}
