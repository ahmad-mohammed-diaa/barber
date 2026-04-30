import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderQueryService } from './services/order-query.service';
import { OrderListingService } from './services/order-listing.service';
import { OrderPricingService } from './services/order-pricing.service';
import { OrderCreateService } from './services/order-create.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderMutationService } from './services/order-mutation.service';
import { PromoCodeModule } from '../promo-code/promo-code.module';
import { NotificationModule } from '../notification/notification.module';
import { OrderReviewService } from './services/order-review.service';

@Module({
  imports: [PromoCodeModule, NotificationModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderQueryService,
    OrderListingService,
    OrderPricingService,
    OrderCreateService,
    OrderLifecycleService,
    OrderMutationService,
    OrderReviewService,
  ],
})
export class OrderModule {}
