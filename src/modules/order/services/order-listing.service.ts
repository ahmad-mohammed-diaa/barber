import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BookingStatus,
  Language,
  OrderStatus,
  Prisma,
  User,
} from '@prisma/client';
import { endOfDay, format, startOfDay } from 'date-fns';
import { Translation } from '../../../class-type/translation';
import { getTranslationNames } from '../../../common/lib/lib';

@Injectable()
export class OrderListingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllOrdersDateRange(
    user: User,
    language: Language,
    fromDate: Date,
    toDate: Date,
  ) {
    const cashier = await this.prisma.cashier.findUnique({
      where: { id: user.id },
      select: { branchId: true },
    });

    const isAdmin = !cashier;
    const branchFilter = isAdmin
      ? {}
      : ({ id: cashier.branchId } as Prisma.BranchWhereInput);
    const startDate = startOfDay(fromDate);
    const endDate = endOfDay(toDate);

    const branches = await this.prisma.branch.findMany({
      where: branchFilter,
      include: {
        _count: {
          select: {
            Order: { where: { date: { gte: startDate, lte: endDate } } },
          },
        },
        Translation: true,
        Order: {
          where: { date: { gte: startDate, lte: endDate } },
          include: {
            branch: { include: { Translation: true } },
            barber: { include: { barber: { include: { user: true } } } },
            client: true,
            service: { include: { Translation: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return branches.map((branch) => ({
      id: branch.id,
      nameEN: branch.Translation.find((t) => t.language === 'EN')?.name,
      nameAR: branch.Translation.find((t) => t.language === 'AR')?.name,
      name: branch.Translation.find((t) => t.language === language)?.name,
      orders: branch.Order.map((order) => {
        const {
          id,
          barber,
          date,
          client,
          promoCode,
          total,
          slot,
          booking,
          status,
          subTotal,
          type,
          discount,
        } = order;
        return {
          id,
          date: format(new Date(date), 'yyyy-MM-dd'),
          ...(barber && {
            barberId: barber.id,
            barberName: `${barber.barber.user.firstName} ${barber.barber.user.lastName}`,
          }),
          clientId: client?.id,
          ...(client?.id && {
            clientName: `${client?.firstName} ${client?.lastName}`,
          }),
          promoCode,
          subTotal,
          discount,
          discountType: type,
          total,
          slot,
          booking,
          status,
        };
      }),
      orderCount: branch._count.Order,
    }));
  }

  async billOrders(date: Date) {
    const order = await this.prisma.order.findMany({
      where: {
        status: 'PAID',
        date: { gte: startOfDay(date), lte: endOfDay(date) },
      },
      select: {
        id: true,
        total: true,
        type: true,
        subTotal: true,
        discount: true,
        freeService: true,
        date: true,
        slot: true,
        client: true,
        points: true,
        barberName: true,
        service: {
          select: {
            id: true,
            Translation: { where: { language: 'EN' }, select: { name: true } },
            price: true,
          },
        },
        Cashier: { select: { firstName: true, lastName: true } },
        barber: { select: { firstName: true, lastName: true } },
        branch: {
          select: {
            Translation: { where: { language: 'EN' }, select: { name: true } },
          },
        },
      },
    });

    const orders = order.map((order) => {
      const {
        service,
        branch,
        date,
        slot,
        barber,
        Cashier,
        client,
        total,
        type,
        subTotal,
        discount,
        freeService,
        barberName,
        ...rest
      } = order;
      return {
        ...rest,
        total: total.toString(),
        subTotal: subTotal.toString(),
        discount: `${discount.toString()} ${type === 'AMOUNT' ? 'EGP' : '%'}`,
        service: service.map((service) => ({
          name: service.Translation[0].name,
          price: freeService.includes(service.id)
            ? '0'
            : service.price.toString(),
        })),
        branch: branch.Translation[0].name,
        barberName: barber
          ? `${barber.firstName} ${barber.lastName}`
          : barberName,
        cashierName: Cashier
          ? `${Cashier.firstName} ${Cashier.lastName}`
          : 'N/A',
        clientName: `${client?.firstName} ${client?.lastName}`,
        day: format(new Date(date), 'EEEE'),
        time: slot,
      };
    });

    return { orders };
  }

  async getCashierOrders(id: string, lang: Language, from: Date, to: Date) {
    const cashier = await this.prisma.cashier.findUnique({ where: { id } });
    if (!cashier) throw new NotFoundException('Cashier not found');

    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        branchId: cashier.branchId,
        NOT: { status: { in: [OrderStatus.PAID] } },
        date: { gte: startOfDay(from), lte: endOfDay(to) },
      },
      include: {
        barber: { include: { barber: { include: { user: true } } } },
        client: { include: { client: true } },
        service: { include: { Translation: { where: { language: lang } } } },
      },
    });

    const settings = await this.prisma.settings.findFirst();
    if (!settings) throw new NotFoundException('Settings not found');

    const TotalSales = await this.prisma.order.aggregate({
      where: {
        date: { gte: startOfDay(from), lte: endOfDay(to) },
        status: OrderStatus.PAID,
      },
      _sum: { total: true },
    });

    const orders = await Promise.all(
      fetchedOrders.map(async (order) => {
        const {
          barber,
          date,
          total,
          subTotal,
          points,
          service,
          id,
          promoCode,
          slot,
          usedPackage,
          client,
          status,
          barberName,
        } = order;

        const usedPackages = await this.prisma.clientPackages.findMany({
          where: { id: { in: usedPackage } },
        });
        const usedPackageIds = usedPackages.flatMap((u) => u.packageId);
        const packageServices = await this.prisma.packages.findMany({
          where: { id: { in: usedPackageIds } },
          include: {
            services: {
              include: { Translation: { where: { language: lang } } },
            },
          },
        });

        const allServices = [
          ...service,
          ...packageServices.flatMap((p) =>
            p.services.map((s) => ({
              ...s,
              name: s.Translation[0].name,
              price: s.price.toString(),
            })),
          ),
        ];

        const duration = allServices
          .reduce((total, service) => total + service.duration, 0)
          .toString();
        const services = service.map((s) => {
          const { Translation, ...rest } = s;
          return {
            ...rest,
            ...getTranslationNames(Translation, lang),
          };
        });

        return {
          id,
          promoCode,
          slot,
          date: format(new Date(date), 'yyyy-MM-dd'),
          status,
          clientPoints: order.client?.client?.points ?? 0,
          branchId: order.branchId,
          duration: `${duration} ${lang === 'EN' ? 'Minutes' : 'دقيقة'}`,
          barberUserName: barber
            ? `${barber?.barber?.user.firstName} ${barber?.barber?.user.lastName}`
            : (barberName ?? ''),
          barberAvatar: barber ? barber?.barber?.user.avatar : null,
          userName: `${client?.firstName}${client?.lastName}`,
          userPhone: client?.phone,
          total: total.toString(),
          subTotal: subTotal.toString(),
          discount: (total - subTotal).toString(),
          points: points.toString(),
          usedPackage: packageServices,
          service: services,
          limit: settings.pointLimit,
        };
      }),
    );

    return { orders, TotalSales: TotalSales._sum.total || 0 };
  }

  async getAllOrders(userId: string, lang: Language) {
    const fetchedOrders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        barber: { include: { barber: { include: { user: true } } } },
        branch: { include: Translation(false, lang) },
        service: { include: { Translation: true } },
      },
    });

    const orders = await Promise.all(
      fetchedOrders.map(async (order) => {
        const {
          barber,
          date,
          total,
          subTotal,
          points,
          service,
          branch: { Translation, ...branchRest },
          booking,
          ...rest
        } = order;

        const usedPackage = await this.prisma.clientPackages.findMany({
          where: { id: { in: order.usedPackage } },
        });
        const usedPackageIds = usedPackage.flatMap((u) => u.packageId);
        const packageServices = await this.prisma.packages.findMany({
          where: { id: { in: usedPackageIds } },
          include: { services: true },
        });
        const allServices = [
          ...service,
          ...packageServices.flatMap((p) => p.services),
        ];
        const duration = allServices
          .reduce((total, service) => total + service.duration, 0)
          .toString();

        return {
          ...rest,
          booking,
          date: format(new Date(date), 'yyyy-MM-dd'),
          duration: `${duration} ${lang === 'EN' ? 'Minutes' : 'دقيقة'}`,
          barber: barber?.barber || null,
          total: total.toString(),
          subTotal: subTotal.toString(),
          discount: (total - subTotal).toString(),
          points: points.toString(),
          usedPackage: packageServices,
          service: service.map((s) => {
            const { Translation, ...serviceRest } = s;
            return {
              ...serviceRest,
              ...getTranslationNames(Translation, lang),
            };
          }),
          branch: { ...branchRest, name: Translation[0].name },
        };
      }),
    );

    const upcoming = orders.filter((o) => o.booking === BookingStatus.UPCOMING);
    const completed = orders.filter((o) => o.booking === BookingStatus.PAST);
    const cancelled = orders.filter(
      (o) => o.booking === BookingStatus.CANCELLED,
    );

    return { upcoming, completed, cancelled };
  }

  async getPayedOrders(lang: Language, from: string, to: string) {
    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        date: { gte: new Date(from), lte: new Date(to) },
        status: OrderStatus.COMPLETED,
      },
      include: {
        barber: { include: { barber: { include: { user: true } } } },
        branch: { include: Translation(false, lang) },
        service: true,
      },
    });

    const orders = await Promise.all(
      fetchedOrders.map(async (order) => {
        const {
          barber,
          date,
          total,
          subTotal,
          points,
          service,
          branch: { Translation, ...branchRest },
          booking,
          ...rest
        } = order;

        const usedPackage = await this.prisma.clientPackages.findMany({
          where: { id: { in: order.usedPackage } },
        });
        const usedPackageIds = usedPackage.flatMap((u) => u.packageId);
        const packageServices = await this.prisma.packages.findMany({
          where: { id: { in: usedPackageIds } },
          include: { services: true },
        });
        const allServices = [
          ...service,
          ...packageServices.flatMap((p) => p.services),
        ];
        const duration = allServices
          .reduce((total, service) => total + service.duration, 0)
          .toString();

        return {
          ...rest,
          booking,
          date: format(new Date(date), 'yyyy-MM-dd'),
          duration: `${duration} ${lang === 'EN' ? 'Minutes' : 'دقيقة'}`,
          barber: barber?.barber || null,
          total: total.toString(),
          subTotal: subTotal.toString(),
          discount: (total - subTotal).toString(),
          points: points.toString(),
          usedPackage: packageServices,
          service,
          branch: { ...branchRest, name: Translation[0].name },
        };
      }),
    );

    return { orders };
  }

  async GetBarberOrders(
    barberId: string,
    language: Language,
    fromDate?: Date,
    toDate?: Date,
  ) {
    const startDate = startOfDay(fromDate ?? new Date());
    const endDate = endOfDay(toDate ?? new Date());

    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        barberId,
        date: { gte: startDate, lte: endDate },
        OR: [
          { status: OrderStatus.PENDING },
          { status: OrderStatus.IN_PROGRESS },
          { booking: BookingStatus.UPCOMING },
        ],
      },
      include: {
        barber: { include: { barber: { include: { user: true } } } },
        branch: { include: Translation(false) },
        service: { include: { Translation: true } },
        client: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    const orders = await Promise.all(
      fetchedOrders.map(async (order) => {
        const {
          barber,
          date,
          total,
          subTotal,
          points,
          service,
          branch: { Translation, ...branchRest },
          booking,
          client,
          ...rest
        } = order;

        const usedPackage = await this.prisma.clientPackages.findMany({
          where: { id: { in: order.usedPackage } },
        });
        const usedPackageIds = usedPackage.flatMap((u) => u.packageId);
        const packageServices = await this.prisma.packages.findMany({
          where: { id: { in: usedPackageIds } },
          include: { services: true },
        });
        const allServices = [
          ...service,
          ...packageServices.flatMap((p) => p.services),
        ];
        const duration = allServices
          .reduce((total, service) => total + service.duration, 0)
          .toString();

        const services = service.map((s) => {
          const { Translation, ...rest } = s;
          return {
            ...rest,
            nameEN: Translation.find((t) => t.language === 'EN')?.name,
            nameAR: Translation.find((t) => t.language === 'AR')?.name,
            name: Translation.find((t) => t.language === language)?.name,
          };
        });

        return {
          ...rest,
          booking,
          date: format(new Date(date), 'yyyy-MM-dd'),
          duration: `${duration} ${language === 'EN' ? 'Minutes' : 'دقيقة'}`,
          barber: barber?.barber || null,
          total: total.toString(),
          subTotal: subTotal.toString(),
          discount: (total - subTotal).toString(),
          points: points.toString(),
          usedPackage: packageServices,
          services,
          branch: {
            ...branchRest,
            nameEN: Translation.find((t) => t.language === 'EN')?.name,
            nameAR: Translation.find((t) => t.language === 'AR')?.name,
            name: Translation.find((t) => t.language === language)?.name,
          },
          userName: `${client?.firstName}${client?.lastName}`,
          userPhone: client?.phone,
        };
      }),
    );

    return { orders };
  }
}
