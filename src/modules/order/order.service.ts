import { Injectable } from '@nestjs/common';
import { Language, Role, User } from '@prisma/client';
import { OrderQueryService } from './services/order-query.service';
import { OrderListingService } from './services/order-listing.service';
import { OrderPricingService } from './services/order-pricing.service';
import { OrderCreateService } from './services/order-create.service';
import { OrderLifecycleService } from './services/order-lifecycle.service';
import { OrderMutationService } from './services/order-mutation.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderServicesDto } from './dto/update-order-services.dto';
import { PaidOrderBodyDto } from './dto/paid-order-body.dto';
import { OrderReviewService } from './services/order-review.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderQuery: OrderQueryService,
    private readonly orderListing: OrderListingService,
    private readonly orderPricing: OrderPricingService,
    private readonly orderCreate: OrderCreateService,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly orderMutation: OrderMutationService,
    private readonly orderReview: OrderReviewService,
  ) {}

  getAllOrders(userId: string, lang: Language) {
    return this.orderListing.getAllOrders(userId, lang);
  }

  getAllOrdersDateRange(
    user: User,
    lang: Language,
    fromDate: Date,
    toDate: Date,
  ) {
    return this.orderListing.getAllOrdersDateRange(
      user,
      lang,
      fromDate,
      toDate,
    );
  }

  GetBarberOrders(
    userId: string,
    lang: Language,
    fromDate?: Date,
    toDate?: Date,
  ) {
    return this.orderListing.GetBarberOrders(userId, lang, fromDate, toDate);
  }

  getNonSelectedServices(id: string, lang: Language) {
    return this.orderPricing.getNonSelectedServices(id, lang);
  }

  getCashierOrders(userId: string, lang: Language, from: Date, to: Date) {
    return this.orderListing.getCashierOrders(userId, lang, from, to);
  }

  billOrders(date: Date) {
    return this.orderListing.billOrders(date);
  }

  deleteOrderServices(id: string, password: string) {
    return this.orderMutation.deleteOrderServices(id, password);
  }

  cancelDeletedServices(id: string, password: string) {
    return this.orderMutation.cancelDeletedServices(id, password);
  }

  updateOrderServices(id: string, dto: UpdateOrderServicesDto) {
    return this.orderMutation.updateOrderServices(id, dto);
  }

  evaluateOrder(id: string, opts: { discount?: number; points?: number }) {
    return this.orderPricing.evaluateOrder(id, opts);
  }

  paidOrder(id: string, body?: PaidOrderBodyDto) {
    return this.orderLifecycle.paidOrder(id, body);
  }

  cancelOrder(id: string, role: Role) {
    return this.orderLifecycle.cancelOrder(id, role);
  }

  startOrder(id: string) {
    return this.orderLifecycle.startOrder(id);
  }

  completeOrder(id: string) {
    return this.orderLifecycle.completeOrder(id);
  }

  ReviewOrder(orderDto: CreateOrderDto, userId: string, lang: Language) {
    return this.orderReview.execute(orderDto, userId, lang);
  }

  getSlots(date: string, barberId?: string, totalDuration?: number) {
    return this.orderPricing.getSlots(date, barberId, totalDuration);
  }

  updateOrder(id: string, dto: UpdateOrderDto, role: Role) {
    return this.orderMutation.updateOrder(id, dto, role);
  }

  getOrderById(id: string) {
    return this.orderPricing.getOrderById(id);
  }

  createOrder(dto: CreateOrderDto, userId: string, lang: Language) {
    return this.orderCreate.execute(dto, userId, lang);
  }

  generateSlot(start: number, end: number) {
    return this.orderMutation.generateSlot(start, end);
  }
}
