import { ApiDoc } from '@/common/lib/swagger';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderServicesDto,
  PaidOrderBodyDto,
  GenerateSlotBodyDto,
} from './dto';

export const GetAllOrdersDoc = () =>
  ApiDoc({ summary: 'Get all orders for the current user', auth: true });

export const GetAllOrdersDateRangeDoc = () =>
  ApiDoc({
    summary: 'Get all orders in a date range (admin/cashier)',
    auth: true,
    queries: [
      { name: 'fromDate', required: false, type: 'string', example: '2025-06-01' },
      { name: 'toDate', required: false, type: 'string', example: '2025-06-30' },
    ],
  });

export const GetBarberOrdersDoc = () =>
  ApiDoc({
    summary: 'Get orders for the current barber',
    auth: true,
    queries: [
      { name: 'fromDate', required: false, type: 'string', example: '2025-06-01' },
      { name: 'toDate', required: false, type: 'string', example: '2025-06-30' },
    ],
  });

export const GetCategoriesDoc = () =>
  ApiDoc({ summary: 'Get non-selected services for an order', auth: true });

export const GetCashierOrdersDoc = () =>
  ApiDoc({
    summary: 'Get orders for the current cashier',
    auth: true,
    queries: [
      { name: 'fromDate', required: false, type: 'string', example: '2025-06-01' },
      { name: 'toDate', required: false, type: 'string', example: '2025-06-30' },
    ],
  });

export const GetPaidOrdersDoc = () =>
  ApiDoc({
    summary: 'Get paid orders for a date',
    auth: true,
    queries: [{ name: 'date', required: false, type: 'string', example: '2025-06-15' }],
  });

export const DeleteOrderServicesDoc = () =>
  ApiDoc({ summary: 'Delete services from an order (requires password)', auth: true });

export const CancelDeletedServicesDoc = () =>
  ApiDoc({ summary: 'Cancel previously deleted services from an order', auth: true });

export const UpdateOrderServicesDoc = () =>
  ApiDoc({
    summary: 'Update services on an order',
    body: UpdateOrderServicesDto,
    extraModels: [UpdateOrderServicesDto],
    auth: true,
  });

export const EvaluateOrderDoc = () =>
  ApiDoc({
    summary: 'Evaluate order total with optional discount/points',
    auth: true,
    queries: [
      { name: 'discount', required: false, type: 'number' },
      { name: 'points', required: false, type: 'number' },
    ],
  });

export const PaidOrderDoc = () =>
  ApiDoc({
    summary: 'Mark an order as paid',
    body: PaidOrderBodyDto,
    extraModels: [PaidOrderBodyDto],
    auth: true,
  });

export const CancelOrderDoc = () =>
  ApiDoc({ summary: 'Cancel an order', auth: true });

export const StartOrderDoc = () =>
  ApiDoc({ summary: 'Start an order', auth: true });

export const CompleteOrderDoc = () =>
  ApiDoc({ summary: 'Mark an order as completed', auth: true });

export const GetOrderDetailsDoc = () =>
  ApiDoc({
    summary: 'Get order price details / preview before booking',
    body: CreateOrderDto,
    extraModels: [CreateOrderDto],
  });

export const GetSlotsDoc = () =>
  ApiDoc({
    summary: 'Get available time slots',
    queries: [
      { name: 'date', required: true, type: 'string', example: '2025-06-15' },
      { name: 'barberId', required: false, type: 'string' },
      { name: 'totalDuration', required: false, type: 'number' },
    ],
  });

export const UpdateOrderDoc = () =>
  ApiDoc({
    summary: 'Update an order',
    body: UpdateOrderDto,
    extraModels: [UpdateOrderDto],
    auth: true,
  });

export const GetOrderByIdDoc = () =>
  ApiDoc({ summary: 'Get order by ID', auth: true });

export const CreateOrderDoc = () =>
  ApiDoc({
    summary: 'Create a new order',
    body: CreateOrderDto,
    extraModels: [CreateOrderDto],
    auth: true,
  });

export const GenerateSlotDoc = () =>
  ApiDoc({
    summary: 'Generate time slots for the system',
    body: GenerateSlotBodyDto,
    extraModels: [GenerateSlotBodyDto],
    auth: true,
  });
