import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSuccess } from 'src/utils/AppSuccess';
import { TranslateName } from '../../lib/lib';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { hashedPassword } from 'src/utils/lib';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAdminDto: CreateAdminDto) {
    const { password, ...rest } = createAdminDto;
    const settings = await this.prisma.settings.findFirst();

    if (!settings) {
      return this.prisma.settings.create({
        data: {
          ...rest,
          ...(password && { password: await hashedPassword(password) }),
        },
      });
    }
  }

  async findAll() {
    const settings = await this.prisma.settings.findFirst();

    if (!settings) {
      return new NotFoundException(null, 'Settings not found');
    }

    return new AppSuccess(settings, 'Settings fetched successfully');
  }

  async update(updateAdminDto: UpdateAdminDto) {
    const { password, ...rest } = updateAdminDto;
    const ExistingSettings = await this.prisma.settings.findFirst();

    if (!ExistingSettings) {
      return new AppSuccess(ExistingSettings, 'Settings not found');
    }

    const settingsData = {
      ...rest,
      ...(password && { password: await hashedPassword(password) }),
    } as Prisma.SettingsUpsertArgs['create'] &
      Prisma.SettingsUpsertArgs['update'];

    const settings = await this.prisma.settings.upsert({
      where: { id: ExistingSettings.id },
      update: settingsData,
      create: settingsData,
    });

    if (updateAdminDto.slotDuration) {
      const slots = await this.prisma.slot.findMany({
        select: {
          id: true,
          start: true,
          end: true,
          slot: true,
        },
      });

      // Update each slot with new duration
      await Promise.all(
        slots.map(async (slot) => {
          try {
            const newSlots = await this.generateSlots(
              slot.start,
              slot.end,
              updateAdminDto.slotDuration,
            );

            return this.prisma.slot.update({
              where: { id: slot.id },
              data: {
                slot: newSlots,
                // Clear any pending slot updates when duration changes
                updatedSlot: [],
                effectiveSlotDate: null,
              },
            });
          } catch (error) {
            console.error(`Failed to update slot ${slot.id}:`, error);
            throw error;
          }
        }),
      );
    }

    return new AppSuccess(settings, 'Settings updated successfully');
  }

  async getBarberOrdersWithCounts(role: Role, fromDate?: Date, toDate?: Date) {
    const TotalOrdersPerDay = await this.AnalyticsSummary();

    switch (role) {
      case Role.CASHIER:
        return new AppSuccess(
          { TotalOrdersPerDay },
          'Cashier orders with counts fetched successfully',
        );

      case Role.ADMIN:
        const today = new Date();
        const oneMonthBefore = new Date();
        oneMonthBefore.setMonth(today.getMonth() - 1);

        const TotalOrdersPerMonth = await this.AnalyticsSummary(
          fromDate ?? oneMonthBefore,
          toDate ?? new Date(),
        );
        const TotalSalesPerBranch = await this.TotalSalesPerBranch(
          fromDate,
          toDate,
        );
        const ServiceUsageSummary = await this.ServiceUsageSummary();

        return new AppSuccess(
          {
            // TotalOrdersPerDay,
            ...TotalOrdersPerMonth,
            TotalSalesPerBranch,
            ServiceUsageSummary,
          },
          'Admin orders with counts fetched successfully',
        );
    }
  }

  private async AnalyticsSummary(fromDate?: Date, toDate?: Date) {
    const today = new Date();

    // Use startOfDay and endOfDay to ensure we capture the full day range
    const startDate = fromDate ? startOfDay(fromDate) : startOfDay(today);
    const endDate = toDate ? endOfDay(toDate) : endOfDay(today);

    const TotalOrderCount = await this.prisma.order.count({
      where: {
        status: OrderStatus.PAID,
        date: { gte: startDate, lte: endDate },
      },
    });
    const TotalOrdersPrice = await this.prisma.order.aggregate({
      where: {
        status: OrderStatus.PAID,
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        total: true,
      },
    });
    return { TotalOrderCount, TotalSales: TotalOrdersPrice._sum.total || 0 };
  }

  private async TotalSalesPerBranch(fromDate?: Date, toDate?: Date) {
    const dateFilter =
      fromDate && toDate
        ? { date: { gte: startOfDay(fromDate), lte: endOfDay(toDate) } }
        : {};

    const fetchedBranches = await this.prisma.branch.findMany({
      select: {
        id: true,
        Translation: true,
        barber: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                id: true,
                BarberOrders: {
                  where: {
                    status: OrderStatus.PAID, // Add this to match TotalSales logic
                    ...dateFilter,
                  },
                  select: {
                    total: true, // ✅ Get the actual order total
                    service: {
                      select: { Translation: true, price: true, id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const branches = fetchedBranches.map((branch) => {
      const { Translation, barber, id } = branch;
      const result = barber.map((barber) => {
        const servicesSummary: {
          id: string;
          name: string;
          price: number;
          count: number;
          totalRevenue: number;
        }[] = [];

        // ✅ Calculate total sales from actual order totals
        const totalSales = barber.user.BarberOrders.reduce(
          (sum, order) => sum + (order.total || 0),
          0,
        );

        barber.user.BarberOrders.forEach((order) => {
          order.service.forEach((srv) => {
            const name =
              TranslateName({ Translation: srv.Translation }, 'EN')?.name ??
              'Unknown';

            const existing = servicesSummary.find((s) => s.id === srv.id);
            if (existing) {
              existing.count += 1;
              existing.totalRevenue += srv.price; // Keep this for service breakdown
            } else {
              servicesSummary.push({
                id: srv.id,
                name: name,
                price: srv.price,
                count: 1,
                totalRevenue: srv.price,
              });
            }
          });
        });

        return {
          id: barber.id,
          barber: `${barber.user.firstName} ${barber.user.lastName}`,
          orderCount: barber.user.BarberOrders.length,
          sales: totalSales, // ✅ Use actual order totals
          services: servicesSummary, // Service breakdown (for reference)
        };
      });
      return {
        id,
        ...TranslateName({ Translation }, 'EN'),
        barbers: result,
      };
    });

    return branches;
  }

  private async ServiceUsageSummary() {
    const branches = await this.prisma.branch.findMany({
      include: { Translation: true },
    });

    const allServices = await this.prisma.service.findMany({
      include: { Translation: true, _count: { select: { order: true } } },
      orderBy: { order: { _count: 'desc' } },
    });

    const result = branches.map((branch) => {
      const services = allServices
        .filter((f) => f._count.order)
        .map((service) => {
          return {
            serviceId: service.id,
            ...TranslateName({ Translation: service.Translation }, 'EN'),
            usageCount: service._count.order || 0,
          };
        });

      return {
        branchId: branch.id,
        ...TranslateName({ Translation: branch.Translation }, 'EN'),
        services,
      };
    });

    return result;
  }

  private async generateSlots(start: number, end: number, duration: number) {
    const slotsArray = [];
    for (let time = start * 60; time < end * 60; time += duration) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;
      const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')} ${period}`;
      slotsArray.push(slot);
    }
    return slotsArray;
  }
}
