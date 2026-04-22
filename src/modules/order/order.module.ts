import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderQueryService } from './services/order-query.service';
import { OrderListingService } from './services/order-listing.service';
import { OrderPricingService } from './services/order-pricing.service';
import { OrderBookingService } from './services/order-booking.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderMutationService } from './services/order-mutation.service';
import { PromoCodeService } from '../../promo-code/promo-code.service';
import { NotificationService } from '../../notification/notification.service';

@Module({
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderQueryService,
    OrderListingService,
    OrderPricingService,
    OrderBookingService,
    OrderLifecycleService,
    OrderMutationService,
    PromoCodeService,
    NotificationService,
  ],
})
export class OrderModule {}
