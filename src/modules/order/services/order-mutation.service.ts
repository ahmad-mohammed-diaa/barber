import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import { OrderPricingService } from './order-pricing.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { UpdateOrderServicesDto } from '../dto/update-order-services.dto';
import { Role } from '@prisma/client';
import { comparePassword } from '../../../utils/lib';

@Injectable()
export class OrderMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderQuery: OrderQueryService,
    private readonly orderPricing: OrderPricingService,
    private readonly orderLifecycle: OrderLifecycleService,
  ) {}

  async updateOrder(id: string, updateOrderDto: UpdateOrderDto, role: Role) {
    const order = await this.orderQuery.findOneOrFail(id);

    if (
      role !== 'ADMIN' &&
      !(
        (order.status === 'PENDING' && role === 'USER') ||
        (order.status === 'IN_PROGRESS' && role === 'BARBER') ||
        (['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(order.status) &&
          role === 'CASHIER')
      )
    ) {
      throw new ConflictException(
        'Order cannot be updated, it has already started or completed.',
      );
    }

    const { add, remove, addPackage, removePackage, barberId, ...rest } =
      updateOrderDto;

    if (barberId && barberId !== order.barberId) {
      let totalDuration = order.service.reduce((acc, s) => acc + s.duration, 0);
      if (Array.isArray(add) && add.length > 0) {
        const addedServices = await this.prisma.service.findMany({
          where: { id: { in: add } },
          select: { duration: true },
        });
        totalDuration += addedServices.reduce((acc, s) => acc + s.duration, 0);
      }
      if (Array.isArray(remove) && remove.length > 0) {
        totalDuration -= order.service
          .filter((s) => remove.includes(s.id))
          .reduce((acc, s) => acc + s.duration, 0);
      }
      const dateWithoutTime = order.date.toISOString().split('T')[0];
      const slotsResult = await this.orderPricing.getSlots(
        dateWithoutTime,
        barberId,
        totalDuration,
      );
      if (!slotsResult.slots || slotsResult.slots.length === 0)
        throw new ConflictException(
          'New barber has no available slots on this date.',
        );
      if (!slotsResult.slots.includes(order.slot))
        throw new ConflictException(
          `The slot ${order.slot} is not available for the new barber.`,
        );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: {
        client: {
          select: { ClientPackages: { include: { packageService: true } } },
        },
      },
    });

    if (
      Array.isArray(add) &&
      add.length > 0 &&
      order.service.flatMap((s) => s.id).some((sid) => add.includes(sid))
    ) {
      throw new BadRequestException('Service already added');
    }

    const clientPackages = user.client?.ClientPackages ?? [];
    const singlePackages = clientPackages.filter(
      (pkg) => pkg.type === 'SINGLE',
    );
    const multiPackages = clientPackages.filter(
      (pkg) => pkg.type === 'MULTIPLE',
    );
    let subTotal = order.subTotal;

    for (const serviceId of add ?? []) {
      const singlePackageService = singlePackages
        .flatMap((pkg) => pkg.packageService)
        .find((ps) => ps.serviceId === serviceId);
      if (singlePackageService) {
        if (
          singlePackageService.remainingCount &&
          singlePackageService.remainingCount > 0
        ) {
          await this.prisma.packagesServices.update({
            where: { id: singlePackageService.id },
            data: { remainingCount: singlePackageService.remainingCount - 1 },
          });
        } else {
          const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            select: { price: true },
          });
          subTotal += service.price;
        }
      } else {
        const service = await this.prisma.service.findUnique({
          where: { id: serviceId },
          select: { price: true },
        });
        subTotal += service.price;
      }
    }

    for (const serviceId of remove ?? []) {
      const singlePackageService = singlePackages
        .flatMap((pkg) => pkg.packageService)
        .find((ps) => ps.serviceId === serviceId);
      if (singlePackageService) {
        if (
          singlePackageService.remainingCount === 0 ||
          !singlePackageService.isActive
        ) {
          await this.prisma.packagesServices.update({
            where: { id: singlePackageService.id },
            data: {
              isActive: true,
              remainingCount: (singlePackageService.remainingCount || 0) + 1,
            },
          });
        } else {
          await this.prisma.packagesServices.update({
            where: { id: singlePackageService.id },
            data: { remainingCount: singlePackageService.remainingCount + 1 },
          });
        }
        const service = await this.prisma.service.findUnique({
          where: { id: singlePackageService.serviceId },
          select: { price: true },
        });
        subTotal -= service.price;
      } else {
        const service = await this.prisma.service.findUnique({
          where: { id: serviceId },
          select: { price: true },
        });
        subTotal -= service.price;
      }
    }

    const discount =
      order.type === 'PERCENTAGE'
        ? (order.discount * subTotal) / 100
        : order.discount;
    const total = Math.max(subTotal - discount, 0);

    if (
      Array.isArray(removePackage) &&
      removePackage.length > 0 &&
      multiPackages.some((pkg) => removePackage.includes(pkg.id))
    ) {
      await this.prisma.clientPackages.updateMany({
        where: {
          id: {
            in: multiPackages
              .filter((pkg) => removePackage.includes(pkg.id))
              .map((pkg) => pkg.id),
          },
          type: 'MULTIPLE',
        },
        data: { isActive: true },
      });
    }

    if (
      Array.isArray(addPackage) &&
      addPackage.length > 0 &&
      multiPackages.some((pkg) => addPackage.includes(pkg.id))
    ) {
      await this.prisma.clientPackages.updateMany({
        where: {
          id: {
            in: multiPackages
              .filter((pkg) => addPackage.includes(pkg.id))
              .map((pkg) => pkg.id),
          },
          type: 'MULTIPLE',
        },
        data: { isActive: false },
      });
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        ...rest,
        ...(barberId && { barberId }),
        subTotal,
        total,
        service: {
          connect: (add ?? []).map((id) => ({ id })),
          disconnect: (remove ?? []).map((id) => ({ id })),
        },
        usedPackage:
          Array.isArray(removePackage) && removePackage.length > 0
            ? [...order.usedPackage, ...(addPackage ?? [])].filter(
                (i) => !removePackage.includes(i),
              )
            : [...order.usedPackage, ...(addPackage ?? [])],
      },
      include: { service: true },
    });
  }

  async updateOrderServices(
    id: string,
    updateOrderServicesDto: UpdateOrderServicesDto,
  ) {
    const order = await this.orderQuery.findOneOrFail(id);
    const { serviceToDelete } = updateOrderServicesDto;

    await this.prisma.order.update({
      where: { id },
      data: {
        shouldBeReviewedByAdmin: true,
        servicesToDelete: serviceToDelete,
      },
    });

    return order;
  }

  async deleteOrderServices(id: string, password: string) {
    const order = await this.orderQuery.findOneOrFail(id);
    const settings = await this.prisma.settings.findFirst({
      select: { password: true },
    });

    if (!password || !(await comparePassword(password, settings.password)))
      throw new BadRequestException('Invalid password');

    const { servicesToDelete, service } = order;
    if (servicesToDelete.length === 0)
      throw new BadRequestException('No services to delete');
    if (servicesToDelete.length === service.length)
      await this.orderLifecycle.cancelOrder(id, Role.ADMIN);

    const totalServicesToDelete = servicesToDelete.reduce((acc, sid) => {
      const s = service.find((sv) => sv.id === sid);
      return acc + s?.price || 0;
    }, 0);

    const newSubTotal = order.subTotal - totalServicesToDelete;
    const newDiscount =
      order.type === 'PERCENTAGE'
        ? (order.discount * newSubTotal) / 100
        : order.discount;
    const newTotal = newSubTotal - newDiscount;

    return this.prisma.order.update({
      where: { id },
      data: {
        service: { disconnect: servicesToDelete.map((sid) => ({ id: sid })) },
        servicesToDelete: [],
        shouldBeReviewedByAdmin: true,
        total: newTotal,
        subTotal: newSubTotal,
      },
    });
  }

  async cancelDeletedServices(id: string, password: string) {
    const settings = await this.prisma.settings.findFirst({
      select: { password: true },
    });
    if (!password || !(await comparePassword(password, settings.password)))
      throw new BadRequestException('Invalid password');
    try {
      await this.orderQuery.findOneOrFail(id);
      await this.prisma.order.update({
        where: { id },
        data: { servicesToDelete: [], shouldBeReviewedByAdmin: false },
      });
      return null;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to cancel deleted services',
      );
    }
  }

  async generateSlot(start: number, end: number) {
    const slotsArray = [];
    const settings = await this.prisma.settings.findFirst({});

    for (let hour = start; hour < end; hour++) {
      for (let minute = 0; minute < 60; minute += settings.slotDuration) {
        const slot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slotsArray.push(
          +slot.split(':')[0] > 11
            ? (+slot.split(':')[0] - 12 === 0 ? 12 : +slot.split(':')[0] - 12)
                .toString()
                .padStart(2, '0') +
                ':' +
                slot.split(':')[1] +
                ' PM'
            : slot + ' AM',
        );
      }
    }

    const existingSlots = await this.prisma.slot.findFirst();

    if (!existingSlots) {
      return this.prisma.slot.create({
        data: { start, end, slot: slotsArray },
      });
    }

    const findFirst = await this.prisma.slot.findFirst();
    return this.prisma.slot.update({
      where: { id: findFirst.id },
      data: { start, end, slot: slotsArray },
    });
  }
}
