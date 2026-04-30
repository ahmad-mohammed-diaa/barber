import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UserData } from '../../common/decorators/user.decorator';
import { Language, User } from '@prisma/client';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RolesGuard } from '../../common/guard/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Lang } from '../../common/decorators/accept.language';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderServicesDto } from './dto/update-order-services.dto';
import { PaidOrderBodyDto } from './dto/paid-order-body.dto';
import { GenerateSlotBodyDto } from './dto/generate-slot-body.dto';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { BarberOrdersQueryDto } from './dto/barber-orders-query.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import {
  GetAllOrdersDoc,
  GetAllOrdersDateRangeDoc,
  GetBarberOrdersDoc,
  GetCategoriesDoc,
  GetCashierOrdersDoc,
  GetPaidOrdersDoc,
  DeleteOrderServicesDoc,
  CancelDeletedServicesDoc,
  UpdateOrderServicesDoc,
  EvaluateOrderDoc,
  PaidOrderDoc,
  CancelOrderDoc,
  StartOrderDoc,
  CompleteOrderDoc,
  GetOrderDetailsDoc,
  GetSlotsDoc,
  UpdateOrderDoc,
  GetOrderByIdDoc,
  CreateOrderDoc,
  GenerateSlotDoc,
} from './order.swagger';

@ApiTags('Order')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(AuthGuard(), RolesGuard)
  @Get()
  @ResponseMessage('Orders fetched successfully')
  @GetAllOrdersDoc()
  async getAllOrders(@UserData('user') user: User, @Lang() lang: Language) {
    return this.orderService.getAllOrders(user.id, lang);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Get('/getAllOrders')
  @ResponseMessage('Orders fetched successfully')
  @GetAllOrdersDateRangeDoc()
  async getNewOrders(
    @Lang() lang: Language,
    @UserData('user') user: User,
    @Query('fromDate') from: string,
    @Query('toDate') to: string,
  ) {
    const today = new Date();
    const oneMonthBefore = new Date();
    oneMonthBefore.setMonth(today.getMonth() - 1);
    const fromDate = new Date(from ?? oneMonthBefore);
    const toDate = new Date(to ?? new Date());
    return this.orderService.getAllOrdersDateRange(
      user,
      lang,
      fromDate,
      toDate,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['BARBER'])
  @Get('/barber-orders')
  @ResponseMessage('Orders fetched successfully')
  @GetBarberOrdersDoc()
  async getBarberOrders(
    @UserData('user') user: User,
    @Lang() lang: Language,
    @Query() query: BarberOrdersQueryDto,
  ) {
    return this.orderService.GetBarberOrders(
      user.id,
      lang,
      query.fromDate ? new Date(query.fromDate) : undefined,
      query.toDate ? new Date(query.toDate) : undefined,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Get('categories/:id')
  @ResponseMessage('Services found successfully')
  @GetCategoriesDoc()
  async getCategories(@Param('id') id: string, @Lang() lang: Language) {
    return this.orderService.getNonSelectedServices(id, lang);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['CASHIER'])
  @Get('/cashier')
  @ResponseMessage('Orders fetched successfully')
  @GetCashierOrdersDoc()
  async getCashierOrders(
    @UserData('user') user: User,
    @Lang() lang: Language,
    @Query('fromDate') from: string,
    @Query('toDate') to: string,
  ) {
    const DateFrom = new Date(from ?? new Date());
    const DateTo = new Date(to ?? new Date());
    return this.orderService.getCashierOrders(user.id, lang, DateFrom, DateTo);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Get('/paid-orders')
  @ResponseMessage('Orders fetched successfully')
  @GetPaidOrdersDoc()
  async getPaidOrders(@Query('date') date: string) {
    const DateFrom = new Date(date ?? new Date());
    return this.orderService.billOrders(DateFrom);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put('/delete-order-services/:id')
  @ResponseMessage('Order services deleted successfully')
  @DeleteOrderServicesDoc()
  async deleteOrderServices(
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    return this.orderService.deleteOrderServices(id, password);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put('/cancel-deleted-services/:id')
  @ResponseMessage('Deleted services cancelled successfully')
  @CancelDeletedServicesDoc()
  async cancelDeletedServices(
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    return this.orderService.cancelDeletedServices(id, password);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Put('/update-order-services/:id')
  @ResponseMessage('Order services updated successfully')
  @UpdateOrderServicesDoc()
  async updateOrderServices(
    @Param('id') id: string,
    @Body() updateOrderServicesDto: UpdateOrderServicesDto,
  ) {
    return this.orderService.updateOrderServices(id, updateOrderServicesDto);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Get('/evaluate-order/:id')
  @ResponseMessage('Order evaluated successfully')
  @EvaluateOrderDoc()
  async evaluateOrder(
    @Param('id') id: string,
    @Query('discount') discount?: number,
    @Query('points') points?: number,
  ) {
    return this.orderService.evaluateOrder(id, { discount, points });
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Put('/paid-order/:id')
  @ResponseMessage('Order marked as paid')
  @PaidOrderDoc()
  async paidOrder(@Param('id') id: string, @Body() body?: PaidOrderBodyDto) {
    return this.orderService.paidOrder(id, body);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Put('/cancel-order/:id')
  @ResponseMessage('Order cancelled successfully')
  @CancelOrderDoc()
  async cancelOrder(@Param('id') id: string, @UserData('user') user: User) {
    return this.orderService.cancelOrder(id, user.role);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'BARBER'])
  @Put('/start-order/:id')
  @ResponseMessage('Order started successfully')
  @StartOrderDoc()
  async startOrder(@Param('id') id: string) {
    return this.orderService.startOrder(id);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'BARBER'])
  @Put('/complete-order/:id')
  @ResponseMessage('Order completed successfully')
  @CompleteOrderDoc()
  async completeOrder(@Param('id') id: string) {
    return this.orderService.completeOrder(id);
  }

  @UseGuards(AuthGuard(false), RolesGuard)
  @Post('/OrderDetails')
  @ResponseMessage('Order details fetched successfully')
  @GetOrderDetailsDoc()
  async getOrderDetails(
    @Body() orderDto: CreateOrderDto,
    @UserData('user') user: User,
    @Lang() lang: Language,
  ) {
    return this.orderService.ReviewOrder(orderDto, user.id, lang);
  }

  @UseGuards(AuthGuard(false), RolesGuard)
  @Get('/slots')
  @ResponseMessage('Slots fetched successfully')
  @GetSlotsDoc()
  async getSlots(@Query() query: GetSlotsQueryDto) {
    return this.orderService.getSlots(
      query.date,
      query.barberId,
      query.totalDuration,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER', 'BARBER'])
  @Put('/:id')
  @ResponseMessage('Order updated successfully')
  @UpdateOrderDoc()
  async updateOrder(
    @Body() updateOrderDto: UpdateOrderDto,
    @Param('id') id: string,
    @UserData('user') user: User,
  ) {
    return this.orderService.updateOrder(id, updateOrderDto, user.role);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Get(':id')
  @ResponseMessage('Order fetched successfully')
  @GetOrderByIdDoc()
  async getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Post()
  @ResponseMessage('Order created successfully')
  @CreateOrderDoc()
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @UserData('user') user: User,
    @Lang() lang: Language,
  ) {
    return this.orderService.createOrder(createOrderDto, user.id, lang);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post('/generate-slot')
  @ResponseMessage('Slots generated successfully')
  @GenerateSlotDoc()
  async generateSlot(@Body() body: GenerateSlotBodyDto) {
    return this.orderService.generateSlot(body.start, body.end);
  }
}
