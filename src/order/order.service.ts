import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AppSuccess } from 'src/utils/AppSuccess';
import { PromoCodeService } from 'src/promo-code/promo-code.service';
import {
  BookingStatus,
  Language,
  OrderStatus,
  Prisma,
  PromoCode,
  Role,
  Service,
  User,
} from '@prisma/client';
import { endOfDay, format, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Translation } from 'src/class-type/translation';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderServicesDto } from './dto/update-order-services.dto';
import { comparePassword, EGYPT_TIMEZONE } from '../utils/lib';
import { NotificationService } from 'src/notification/notification.service';

interface PrismaServiceType extends Service {
  isFree: boolean;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly promoCodeService: PromoCodeService,
    private readonly notificationService: NotificationService,
  ) {}

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

    // Use startOfDay and endOfDay to ensure we capture the full day range
    const fromStart = fromZonedTime(
      startOfDay(toZonedTime(fromDate, EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );
    const toEnd = fromZonedTime(
      endOfDay(toZonedTime(toDate, EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );

    const branches = await this.prisma.branch.findMany({
      where: branchFilter,
      include: {
        _count: {
          select: {
            Order: {
              where: {
                date: {
                  gte: fromStart,
                  lte: toEnd,
                },
              },
            },
          },
        },
        Translation: true,
        Order: {
          where: {
            date: {
              gte: fromStart,
              lte: toEnd,
            },
          },
          include: {
            branch: {
              include: {
                Translation: true,
              },
            },
            barber: {
              include: {
                barber: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            client: true,
            service: {
              include: {
                Translation: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    const formattedOrders = branches.map((branch) => ({
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

    return new AppSuccess(formattedOrders, 'Orders fetched successfully');
  }

  async getNonSelectedServices(id: string, language: Language) {
    const order = await this.findOneOrFail(id);

    const FetchedCategory = await this.prisma.category.findMany({
      include: {
        Translation: true,
        services: {
          where: {
            id: {
              notIn: order.service.flatMap((o) => o.id),
            },
          },
          include: {
            Translation: true,
          },
        },
      },
    });

    const category = FetchedCategory.map((category) => {
      const { Translation, services, ...rest } = category;
      return {
        ...rest,
        nameEN: Translation.find((t) => t.language === 'EN')?.name,
        nameAR: Translation.find((t) => t.language === 'AR')?.name,
        name: Translation.find((t) => t.language === language)?.name,
        services: services.map((service) => {
          const { Translation, ...rest } = service;
          return {
            ...rest,
            nameEN: Translation.find((t) => t.language === 'EN')?.name,
            nameAR: Translation.find((t) => t.language === 'AR')?.name,
            name: Translation.find((t) => t.language === language)?.name,
          };
        }),
      };
    });

    return new AppSuccess({ category }, 'Services found successfully');
  }

  async billOrders(date: Date) {
    const order = await this.prisma.order.findMany({
      where: {
        status: 'PAID',
        date: {
          gte: startOfDay(toZonedTime(date, EGYPT_TIMEZONE)),
          lte: endOfDay(toZonedTime(date, EGYPT_TIMEZONE)),
        },
      },
      orderBy: {
        date: 'asc',
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

    return new AppSuccess({ orders }, 'Orders fetched successfully');
  }

  async getCashierOrders(id: string, lang: Language, from: Date, to: Date) {
    const cashier = await this.prisma.cashier.findUnique({
      where: { id },
    });
    if (!cashier) throw new NotFoundException('Cashier not found');

    const fromStart = fromZonedTime(
      startOfDay(toZonedTime(from, EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );
    const toEnd = fromZonedTime(
      endOfDay(toZonedTime(to, EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );
    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        branchId: cashier.branchId,
        NOT: {
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.ADMIN_CANCELLED,
              OrderStatus.CLIENT_CANCELLED,
              OrderStatus.BARBER_CANCELLED,
              OrderStatus.CASHIER_CANCELLED,
            ],
          },
        },
        date: {
          gte: fromStart,
          lte: toEnd,
        },
      },
      orderBy: { date: 'asc' },
      include: {
        barber: { include: { barber: { include: { user: true } } } },
        client: { include: { client: true } },
        service: {
          include: {
            Translation: { where: { language: lang } },
          },
        },
      },
    });

    const settings = await this.prisma.settings.findFirst();
    if (!settings) throw new NotFoundException('Settings not found');

    const TotalSales = await this.prisma.order.aggregate({
      where: {
        date: {
          gte: startOfDay(toZonedTime(from, EGYPT_TIMEZONE)),
          lte: endOfDay(toZonedTime(to, EGYPT_TIMEZONE)),
        },
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
              include: {
                Translation: { where: { language: lang } },
              },
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
            nameEN: Translation.find((t) => t.language === 'EN')?.name,
            nameAR: Translation.find((t) => t.language === 'AR')?.name,
            name: Translation.find((t) => t.language === lang)?.name,
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
            ? `${barber.barber.user.firstName} ${barber.barber.user.lastName}`
            : (barberName ?? ''),
          barberAvatar: barber ? barber.barber.user.avatar : null,
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

    return new AppSuccess(
      { orders, TotalSales: TotalSales._sum.total || 0 },
      'Orders fetched successfully',
    );
  }

  async getAllOrders(userId: string, lang: Language) {
    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        userId: userId,
        // deleted: false
      },
      include: {
        barber: { include: { barber: { include: { user: true } } } },
        branch: { include: Translation(false, lang) },
        service: { include: { Translation: true } },
      },
      orderBy: {
        date: 'desc',
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
              nameEN: Translation.find((t) => t.language === 'EN').name,
              nameAR: Translation.find((t) => t.language === 'AR').name,
              name: Translation.find((t) => t.language === lang).name,
            };
          }),
          branch: {
            ...branchRest,
            name: Translation[0].name,
          },
        };
      }),
    );

    const upcoming = orders.filter(
      (order) => order.booking === BookingStatus.UPCOMING,
    );
    const completed = orders.filter(
      (order) => order.booking === BookingStatus.PAST,
    );
    const cancelled = orders.filter(
      (order) => order.booking === BookingStatus.CANCELLED,
    );

    return new AppSuccess(
      { upcoming, completed, cancelled },
      'Orders fetched successfully',
    );
  }

  async getPayedOrders(lang: Language, from: string, to: string) {
    const fromStart = fromZonedTime(
      startOfDay(toZonedTime(from, EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );
    const toEnd = fromZonedTime(
      endOfDay(toZonedTime(to, EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );
    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        date: {
          gte: fromStart,
          lte: toEnd,
        },
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
          branch: {
            ...branchRest,
            name: Translation[0].name,
          },
        };
      }),
    );

    return new AppSuccess({ orders }, 'Orders fetched successfully');
  }

  async GetBarberOrders(
    barberId: string,
    language: Language,
    fromDate?: Date,
    toDate?: Date,
  ) {
    const fromStart = fromZonedTime(
      startOfDay(toZonedTime(new Date(fromDate ?? new Date()), EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );
    const toEnd = fromZonedTime(
      endOfDay(toZonedTime(new Date(toDate ?? new Date()), EGYPT_TIMEZONE)),
      EGYPT_TIMEZONE,
    );

    const fetchedOrders = await this.prisma.order.findMany({
      where: {
        barberId: barberId,
        date: { gte: fromStart, lte: toEnd },
        OR: [
          { status: OrderStatus.PENDING },
          { status: OrderStatus.IN_PROGRESS },
          { booking: BookingStatus.UPCOMING },
        ],
      },
      orderBy: { date: 'asc' },
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

    return new AppSuccess({ orders }, 'Orders fetched successfully');
  }

  async getOrderById(id: string, lang: Language) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          service: { include: { Translation: true } },
          barber: { include: { barber: true } },
          client: true,
        },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const services = order.service.map((service) => {
        const { Translation, ...rest } = service;
        return {
          ...rest,
          nameEN: Translation.find((t) => t.language === 'EN')?.name,
          nameAR: Translation.find((t) => t.language === 'AR')?.name,
          name: Translation.find((t) => t.language === lang)?.name,
        };
      });

      const { client, service: _, ...rest } = order;

      return new AppSuccess(
        {
          ...rest,
          service: services,
          clientName: `${client.firstName} ${client.lastName}`,
          clientPhone: client.phone,
          totalDiscount: order.subTotal - order.total,
        },
        'Order fetched successfully',
        200,
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to get order by id');
    }
  }

  async GetData(
    createOrderDto: CreateOrderDto,
    userId: string,
    lang: Language,
  ) {
    const {
      promoCode,
      service,
      slot,
      barberId,
      date,
      branchId,
      usedPackage,
      points,
      phone,
    } = createOrderDto;
    try {
      if (points && points <= 0) {
        throw new BadRequestException('You have exceeded the points limit');
      }
      const dateWithoutTime = new Date(date).toISOString().split(/[ T]/)[0];
      const allServices = [] as PrismaServiceType[];

      const another =
        phone &&
        phone !== '' &&
        (await this.prisma.user.findUnique({ where: { phone } }));
      userId = another ? another.id : userId;

      // Fetch services early to calculate total duration
      const FetchedServices = await this.prisma.service.findMany({
        where: { id: { in: service } },
      });

      // Calculate total duration in minutes for slot validation
      const totalDuration = FetchedServices.reduce(
        (acc, service) => acc + service.duration,
        0,
      );

      const [order, usedPromoCode, slots, validPromoCode, user] =
        await Promise.all([
          await this.prisma.order.findFirst({
            where: {
              ...(barberId && { barberId: barberId }),
              date: this.slotToDatetime(dateWithoutTime, slot),
              slot: slot,
              OR: [
                { status: 'PENDING' },
                { status: 'IN_PROGRESS' },
                { booking: 'UPCOMING' },
              ],
            },
          }),
          await this.prisma.user.findFirst({
            where: { id: userId },
            select: {
              client: { select: { points: true } },
              UserOrders: {
                where: {
                  promoCode: promoCode,
                  status: 'PENDING',
                },
              },
            },
          }),
          barberId
            ? (await this.getSlots(dateWithoutTime, barberId, totalDuration))
                .data.slots
            : [],
          promoCode &&
            (await this.promoCodeService.validatePromoCode(promoCode)).data,

          await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
              client: {
                select: {
                  ban: true,
                  user: {
                    select: { firstName: true, lastName: true, phone: true },
                  },
                },
              },
              role: true,
            },
          }),
        ]);

      if (phone && !user) {
        throw new NotFoundException('User not found');
      }

      const settings = await this.prisma.settings.findFirst({});

      if (points && points <= 0 && settings.pointLimit > points) {
        throw new BadRequestException('You have exceeded the points limit');
      }

      if (usedPromoCode.UserOrders.length && promoCode)
        throw new ConflictException(
          `Promo code "${promoCode}" is invalid or expired.`,
        );

      if (order) throw new ConflictException(`Slot ${slot} is already booked`);

      if (barberId && !slots.includes(slot))
        throw new ServiceUnavailableException(`Slot ${slot} is Unavailable`);

      let costServices = [] as PrismaServiceType[];
      if (user?.role === 'USER') {
        const clientPackages = await this.prisma.clientPackages.findMany({
          where: {
            clientId: userId,
            packageService: {
              some: { isActive: true, remainingCount: { gt: 0 } },
            },
          },
          select: {
            id: true,
            type: true,
            isActive: true,
            packageService: {
              select: { service: true },
            },
          },
        });

        const selectedPackage = clientPackages.filter((pkg) =>
          usedPackage.includes(pkg.id),
        );

        const notValidPackage = selectedPackage.filter((pkg) => !pkg.isActive);

        if (notValidPackage.length > 0) {
          throw new BadRequestException('This package is not valid anymore');
        }

        const single = clientPackages
          .filter((pkg) => pkg.type === 'SINGLE' && pkg.isActive)
          .flatMap((pkg) =>
            pkg.packageService.flatMap((ps) => {
              return { ...ps.service, pkgId: pkg.id };
            }),
          );

        const services = FetchedServices.map((srv) => ({
          ...srv,
          isFree: single.some((s) => s.id === srv.id),
        }));

        allServices.push(...services);

        for (const pkg of selectedPackage) {
          if (pkg.type === 'SINGLE') {
            throw new ConflictException(
              'Can not select Packages of type SINGLE',
            );
          } else {
            const service = pkg.packageService.flatMap((ps) => {
              return { ...ps.service, isFree: true };
            });

            allServices.push(...service);
          }
        }

        costServices = allServices.filter((service) => !service.isFree);
      }
      if (user?.role !== 'USER') {
        const services = FetchedServices.map((srv) => ({
          ...srv,
          isFree: false,
        }));
        allServices.push(...services);
        costServices = allServices;
      }

      const subTotal = costServices.reduce(
        (acc, service) => acc + service.price,
        0,
      );

      // Points validation: minimum 1000 points, conversion rate: 1000 points = 50 EGP
      let pointsDiscount = 0;

      if (points) {
        if (points < 1000) {
          throw new BadRequestException('Minimum points required is 1000');
        }

        if (points > usedPromoCode?.client?.points) {
          throw new BadRequestException('You do not have enough points');
        }

        // Convert points to EGP: every 1000 points = 50 EGP
        pointsDiscount = Math.floor(points / 1000) * 50;

        if (pointsDiscount > subTotal) {
          throw new BadRequestException(
            'Points discount cannot exceed the subtotal',
          );
        }
      }

      const discount = promoCode
        ? validPromoCode?.type === 'PERCENTAGE'
          ? (subTotal * validPromoCode?.discount) / 100
          : validPromoCode?.discount
        : 0;

      const total = Math.max(subTotal - discount - pointsDiscount, 0);

      const duration = allServices.reduce(
        (acc, service) => acc + service.duration,
        0,
      );

      const now = new Date();

      const diffInMs = new Date(dateWithoutTime).getTime() - now.getTime(); // difference in milliseconds
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
      if (!settings) {
        throw new NotFoundException('Settings not found');
      }
      if (diffInDays >= settings.maxDaysBooking)
        throw new BadRequestException(
          `You can only book up to ${settings.maxDaysBooking} days in advance`,
        );

      const discountDisplay =
        promoCode && pointsDiscount > 0
          ? validPromoCode?.type === 'PERCENTAGE'
            ? `${validPromoCode?.discount}% + ${pointsDiscount}EGP`
            : `${discount}EGP + ${pointsDiscount}EGP`
          : promoCode
            ? validPromoCode?.type === 'PERCENTAGE'
              ? `${validPromoCode?.discount}%`
              : `${validPromoCode?.discount}EGP`
            : pointsDiscount > 0
              ? `${pointsDiscount}EGP`
              : '0';

      return new AppSuccess(
        {
          date: dateWithoutTime,
          slot,
          ...(barberId && { barberId }),
          branchId,
          canUsePoints:
            settings.pointLimit < usedPromoCode?.client?.points ||
            settings.pointLimit > settings.pointLimit + 1,
          points: points?.toString(),
          clientName: `${user?.client?.user?.firstName} ${user?.client?.user?.lastName}`,
          clientPhone: user?.client?.user?.phone,
          createdAt: new Date(),
          updatedAt: null,
          ...(phone && { phone }),
          duration: `${duration} ${lang === 'EN' ? 'Minutes' : 'دقيقة'}`,
          promoCode: promoCode ? promoCode : null,
          subTotal: subTotal?.toString(),
          discount: discountDisplay,
          pointsDiscount: pointsDiscount.toString(),
          total: total.toString(),
          limit: settings.pointLimit.toString(),
        },
        'Data fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error in GetData:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        code: error.code,
        status: error.status,
      });
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get data');
    }
  }

  async createOrder(
    createOrderDto: CreateOrderDto,
    userId: string,
    lang: Language,
  ) {
    const {
      slot,
      service,
      barberId,
      branchId,
      usedPackage,
      promoCode,
      points,
      phone,
      barberName,
      ...rest
    } = createOrderDto;

    console.log('CreateOrder - barberId received:', barberId);
    if (points !== undefined && points !== null && !Number.isInteger(points)) {
      throw new BadRequestException('Points must be a number');
    }
    if (points && points < 1000) {
      throw new BadRequestException('Minimum points required is 1000');
    }

    const allServices = [] as PrismaServiceType[];
    const dateWithoutTime = new Date(createOrderDto.date)
      .toISOString()
      .split(/[ T]/)[0];

    const another =
      phone && (await this.prisma.user.findUnique({ where: { phone } }));

    userId = another ? another.id : userId;

    // Fetch services early to calculate total duration
    const FetchedServices = await this.prisma.service.findMany({
      where: { id: { in: service } },
    });

    // Calculate total duration in minutes for slot validation
    const totalDuration = FetchedServices.reduce(
      (acc, service) => acc + service.duration,
      0,
    );

    const [existingOrder, usedPromoCode, slots, validPromoCode, user] =
      await Promise.all([
        await this.prisma.order.findFirst({
          where: {
            ...(barberId && { barberId: barberId }),
            date: this.slotToDatetime(dateWithoutTime, slot),
            slot: slot,
            OR: [
              { status: 'PENDING' },
              { status: 'IN_PROGRESS' },
              { booking: 'UPCOMING' },
            ],
          },
        }),
        await this.prisma.user.findFirst({
          where: { id: userId },
          select: {
            UserOrders: {
              where: {
                promoCode: promoCode,
                status: 'PENDING',
              },
            },
          },
        }),
        barberId
          ? (await this.getSlots(dateWithoutTime, barberId, totalDuration)).data
              .slots
          : [],
        promoCode &&
          (await this.promoCodeService.validatePromoCode(promoCode)).data,
        await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            client: { select: { points: true, ban: true } },
            role: true,
          },
        }),
      ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user?.client?.ban) {
      throw new BadRequestException('You are banned');
    }

    const settings = await this.prisma.settings.findFirst({});
    const now = new Date();

    const diffInMs = new Date(dateWithoutTime).getTime() - now.getTime(); // difference in milliseconds
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    console.log(diffInDays, settings.maxDaysBooking);
    if (!settings) {
      throw new NotFoundException('Settings not found');
    }
    if (diffInDays > settings.maxDaysBooking) {
      throw new ConflictException(
        `You can only book up to ${settings.maxDaysBooking} days in advance`,
      );
    }

    if (usedPromoCode.UserOrders.length && promoCode) {
      throw new ConflictException(
        `Promo code "${promoCode}" is invalid or expired.`,
      );
    }

    if (existingOrder) {
      throw new ConflictException(`Slot ${slot} is already booked`);
    }

    if (barberId && !slots.includes(slot)) {
      throw new ServiceUnavailableException(`Slot ${slot} is Unavailable`);
    }

    const barber = barberId
      ? await this.prisma.barber.findUnique({
          where: { id: barberId },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : null;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    const Services = await this.prisma.service.findMany({
      where: { id: { in: service } },
    });

    if (barberId && !barber) throw new NotFoundException('Barber not found');
    if (!branch) throw new NotFoundException('Branch not found');
    if (!Services || !Services.length)
      throw new NotFoundException('Service not found');

    const clientPackages = await this.prisma.clientPackages.findMany({
      where: {
        clientId: userId,
        packageService: { some: { isActive: true, remainingCount: { gt: 0 } } },
      },
      select: {
        id: true,
        type: true,
        isActive: true,
        packageService: {
          select: { service: true },
        },
      },
    });

    const selectedPackage = clientPackages.filter((pkg) =>
      usedPackage.includes(pkg.id),
    );

    const notValidPackage = selectedPackage.filter((pkg) => !pkg.isActive);

    if (notValidPackage.length > 0)
      throw new BadRequestException('This package is not valid anymore');

    const single = clientPackages
      .filter((pkg) => pkg.type === 'SINGLE')
      .flatMap((pkg) =>
        pkg.packageService.flatMap((ps) => {
          return { ...ps.service, pkgId: pkg.id };
        }),
      );

    const services = FetchedServices.map((srv) => ({
      ...srv,
      isFree: single.some((s) => s.id === srv.id),
    }));

    allServices.push(...services);

    for (const pkg of selectedPackage) {
      if (pkg.type === 'SINGLE') {
        throw new ConflictException('Can not select Packages of type SINGLE');
      } else {
        const service = pkg.packageService.flatMap((ps) => {
          return { ...ps.service, isFree: true };
        });

        allServices.push(...service);
      }
    }

    const costServices = allServices.filter((service) => !service.isFree);

    const subTotal = costServices.reduce(
      (acc, service) => acc + service.price,
      0,
    );

    // Points validation: minimum 1000 points, conversion rate: 1000 points = 50 EGP
    let pointsToUse = 0;
    let pointsDiscount = 0;

    if (points) {
      if (points < 1000) {
        throw new BadRequestException('Minimum points required is 1000');
      }

      if (points > user.client?.points) {
        throw new BadRequestException('You do not have enough points');
      }

      // Convert points to EGP: every 1000 points = 50 EGP
      pointsDiscount = Math.floor(points / 1000) * 50;

      if (pointsDiscount > subTotal) {
        throw new BadRequestException(
          'Points discount cannot exceed the subtotal',
        );
      }

      pointsToUse = points;
    }

    const discount = promoCode
      ? validPromoCode?.type === 'PERCENTAGE'
        ? (subTotal * validPromoCode?.discount) / 100
        : validPromoCode?.discount
      : 0;

    const total = Math.max(subTotal - discount - pointsDiscount, 0);

    if (user?.client?.ban) throw new ForbiddenException('You are banned');

    let order;

    if (user.role === 'USER') {
      order = await this.prisma.order.create({
        data: {
          ...rest,
          ...(validPromoCode && { promoCode }),
          slot,
          userId,
          ...(barberId && { barberId }),
          barberName: `${barber?.user.firstName} ${barber?.user.lastName}`,
          branchId,
          points: pointsToUse,
          usedPackage: selectedPackage
            ? selectedPackage.flatMap((e) => e.id)
            : [],
          date: this.slotToDatetime(dateWithoutTime, slot),
          service: {
            connect: allServices.map((service) => ({ id: service.id })),
          },
          subTotal,
          total,
        },
        include: {
          service: {
            include: {
              PackagesServices: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      const packageServiceIds = order.service.flatMap((s) =>
        s.PackagesServices.map((ps) => ps.id),
      );

      await this.prisma.$transaction(async (prisma) => {
        const packageService = await prisma.packagesServices.findMany({
          where: {
            id: { in: packageServiceIds },
            ClientPackages: { clientId: order.userId, type: 'SINGLE' },
            isActive: true,
          },
        });

        const pkgServiceIds = packageService.flatMap((ps) => ps.id);

        if (pkgServiceIds.length > 0) {
          await prisma.packagesServices.updateMany({
            where: {
              id: { in: pkgServiceIds },
              ClientPackages: { clientId: order.userId, type: 'SINGLE' },
              isActive: true,
            },
            data: {
              ...(packageService[0].remainingCount < 1 && {
                isActive: false,
              }),
              usedAt: new Date(),
              remainingCount: {
                decrement: 1,
              },
            },
          });
        }

        if (selectedPackage) {
          await this.prisma.clientPackages.updateMany({
            where: {
              id: { in: usedPackage },
              clientId: order.userId,
              type: 'MULTIPLE',
            },
            data: {
              isActive: false,
            },
          });
        }
      });
      if (pointsToUse > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            client: {
              update: {
                points: {
                  decrement: pointsToUse,
                },
              },
            },
          },
        });
      }
    } else {
      order = await this.prisma.order.create({
        data: {
          ...rest,
          ...(validPromoCode && { promoCode }),
          slot,
          userId,
          barberId,
          barberName:
            barberName || `${barber?.user.firstName} ${barber?.user.lastName}`,
          branchId,
          points: pointsToUse,
          discount: validPromoCode ? validPromoCode.discount : 0,
          type: validPromoCode ? validPromoCode.type : 'AMOUNT',
          usedPackage: selectedPackage
            ? selectedPackage.flatMap((e) => e.id)
            : [],
          freeService: allServices.filter((s) => s.isFree).flatMap((s) => s.id),
          date: this.slotToDatetime(dateWithoutTime, slot),
          service: {
            connect: allServices.map((service) => ({ id: service.id })),
          },
          subTotal,
          total,
        },
        include: {
          service: {
            include: {
              PackagesServices: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
    }

    console.log('Order created with barberId:', order.barberId);
    console.log('Order created with barberName:', order.barberName);

    const duration = allServices.reduce(
      (acc, service) => acc + service.duration,
      0,
    );

    const discountDisplay =
      promoCode && pointsDiscount > 0
        ? validPromoCode?.type === 'PERCENTAGE'
          ? `${validPromoCode?.discount}% + ${pointsDiscount}EGP`
          : `${discount}EGP + ${pointsDiscount}EGP`
        : promoCode
          ? validPromoCode?.type === 'PERCENTAGE'
            ? `${validPromoCode?.discount}%`
            : `${validPromoCode?.discount}EGP`
          : pointsDiscount > 0
            ? `${pointsDiscount}EGP`
            : '0';

    return new AppSuccess(
      {
        date: format(order.date, 'yyyy-MM-dd'),
        slot: order.slot,
        ...(barberId && { barberId: order.barberId }),
        branchId: order.branchId,
        barberName: order.barberName,
        points: order.points?.toString(),
        createdAt: order.createdAt,
        updatedAt: null,
        duration: `${duration} ${lang === 'AR' ? 'دقيقة' : 'minutes'}`,
        promoCode: promoCode ? promoCode : null,
        subTotal: order.subTotal?.toString(),
        discount: discountDisplay,
        total: order.total?.toString(),
      },
      'Order created successfully',
    );
  }

  async updateOrder(id: string, updateOrderDto: UpdateOrderDto, Role: Role) {
    const order = await this.findOneOrFail(id);

    if (
      Role !== 'ADMIN' &&
      !(
        (order.status === 'PENDING' && Role === 'USER') ||
        (order.status === 'IN_PROGRESS' && Role === 'BARBER') ||
        (['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(order.status) &&
          Role === 'CASHIER')
      )
    ) {
      throw new ConflictException(
        'Order cannot be updated, it has already started or completed.',
      );
    }

    const { add, remove, addPackage, removePackage, barberId, ...rest } =
      updateOrderDto;

    if (barberId && barberId !== order.barberId) {
      let totalDuration = order.service.reduce(
        (acc, service) => acc + service.duration,
        0,
      );

      if (Array.isArray(add) && add.length > 0) {
        const addedServices = await this.prisma.service.findMany({
          where: { id: { in: add } },
          select: { duration: true },
        });
        totalDuration += addedServices.reduce(
          (acc, service) => acc + service.duration,
          0,
        );
      }

      if (Array.isArray(remove) && remove.length > 0) {
        const removedServices = order.service.filter((s) =>
          remove.includes(s.id),
        );
        totalDuration -= removedServices.reduce(
          (acc, service) => acc + service.duration,
          0,
        );
      }

      const dateWithoutTime = order.date.toISOString().split('T')[0];

      const slotsResult = await this.getSlots(
        dateWithoutTime,
        barberId,
        totalDuration,
      );

      if (!slotsResult.data.slots || slotsResult.data.slots.length === 0) {
        throw new ConflictException(
          'New barber has no available slots on this date.',
        );
      }

      if (!slotsResult.data.slots.includes(order.slot)) {
        throw new ConflictException(
          `The slot ${order.slot} is not available for the new barber. The new barber needs ${totalDuration} minutes of consecutive free slots starting at ${order.slot}.`,
        );
      }
    }
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: {
        client: {
          select: {
            ClientPackages: {
              include: {
                packageService: true,
              },
            },
          },
        },
      },
    });

    if (
      Array.isArray(add) &&
      add.length > 0 &&
      order.service.flatMap((s) => s.id).some((id) => add.includes(id))
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
        .find((pkgService) => pkgService.serviceId === serviceId);

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
        .find((pkgService) => pkgService.serviceId === serviceId);

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
          const service = await this.prisma.service.findUnique({
            where: { id: singlePackageService.serviceId },
            select: { price: true },
          });

          subTotal -= service.price;
        } else {
          await this.prisma.packagesServices.update({
            where: { id: singlePackageService.id },
            data: { remainingCount: singlePackageService.remainingCount + 1 },
          });
          const service = await this.prisma.service.findUnique({
            where: { id: singlePackageService.serviceId },
            select: { price: true },
          });
          subTotal -= service.price;
        }
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

    const updatedOrder = await this.prisma.order.update({
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
      include: {
        service: true,
      },
    });

    return new AppSuccess(updatedOrder, 'Order updated successfully');
  }

  async updateOrderServices(
    id: string,
    updateOrderServicesDto: UpdateOrderServicesDto,
  ) {
    const order = await this.findOneOrFail(id);
    const { serviceToDelete } = updateOrderServicesDto;

    await this.prisma.order.update({
      where: { id },
      data: {
        shouldBeReviewedByAdmin: true,
        servicesToDelete: serviceToDelete,
      },
    });

    return new AppSuccess(order, 'Order services updated successfully');
  }

  async deleteOrderServices(id: string, password: string) {
    const order = await this.findOneOrFail(id);
    const settings = await this.prisma.settings.findFirst({
      select: {
        password: true,
      },
    });

    if (!password || !(await comparePassword(password, settings.password))) {
      throw new BadRequestException('Invalid password');
    }

    const { servicesToDelete, service } = order;

    if (servicesToDelete.length === 0) {
      throw new BadRequestException('No services to delete');
    }

    if (servicesToDelete.length === service.length) {
      await this.cancelOrder(id, Role.ADMIN);
    }

    const totalServicesToDelete = servicesToDelete.reduce((acc, id) => {
      const services = service.find((s) => s.id === id);
      return acc + services?.price || 0;
    }, 0);

    const newSubTotal = order.subTotal - totalServicesToDelete;

    let newDiscount = 0;

    if (order.type === 'PERCENTAGE') {
      newDiscount = (order.discount * newSubTotal) / 100;
    } else {
      newDiscount = order.discount;
    }

    const newTotal = newSubTotal - newDiscount;

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        service: { disconnect: servicesToDelete.map((id) => ({ id })) },
        servicesToDelete: [],
        shouldBeReviewedByAdmin: true,
        total: newTotal,
        subTotal: newSubTotal,
      },
    });
    return new AppSuccess(updatedOrder, 'Order services deleted successfully');
  }

  async cancelDeletedServices(id: string, password: string) {
    const settings = await this.prisma.settings.findFirst({
      select: {
        password: true,
      },
    });
    if (!password || !(await comparePassword(password, settings.password))) {
      throw new BadRequestException('Invalid password');
    }
    try {
      await this.findOneOrFail(id);
      await this.prisma.order.update({
        where: { id },
        data: {
          servicesToDelete: [],
          shouldBeReviewedByAdmin: false,
        },
      });
      return new AppSuccess(null, 'Deleted services cancelled successfully');
    } catch (error) {
      console.log('error', error);
      throw new InternalServerErrorException(
        'Failed to cancel deleted services',
      );
    }
  }

  async cancelOrder(id: string, role: Role) {
    this.findOneOrFail(id);
    const settings = await this.prisma.settings.findFirst({
      select: {
        canceledOrder: true,
      },
    });
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      include: {
        service: {
          include: {
            PackagesServices: {
              select: {
                id: true,
              },
            },
          },
        },
      },
      data: {
        booking: BookingStatus.CANCELLED,
        ...(role === Role.ADMIN && { status: OrderStatus.ADMIN_CANCELLED }),
        ...(role === Role.USER && { status: OrderStatus.CLIENT_CANCELLED }),
        ...(role === Role.BARBER && { status: OrderStatus.BARBER_CANCELLED }),
        ...(role === Role.CASHIER && { status: OrderStatus.CASHIER_CANCELLED }),
      },
    });
    if (updatedOrder.points && updatedOrder.points > 0) {
      // Only update client points if the user has a client record
      const client = await this.prisma.client.findUnique({
        where: { id: updatedOrder.userId },
      });

      if (client) {
        await this.prisma.client.update({
          where: { id: updatedOrder.userId },
          data: {
            points: {
              increment: updatedOrder.points,
            },
          },
        });
      }
    }

    if (
      updatedOrder.status === OrderStatus.IN_PROGRESS ||
      updatedOrder.status === OrderStatus.COMPLETED ||
      updatedOrder.status === OrderStatus.PAID
    ) {
      throw new ConflictException(
        'Order cannot be cancelled, it has already started or completed.',
      );
    }

    const packageServiceIds = updatedOrder.service.flatMap((s) =>
      s.PackagesServices.map((ps) => ps.id),
    );

    await this.prisma.$transaction(async (prisma) => {
      if (packageServiceIds.length >= 1) {
        await prisma.packagesServices.updateMany({
          where: {
            id: { in: packageServiceIds },
            ClientPackages: { clientId: updatedOrder.userId, type: 'SINGLE' },
          },
          data: {
            isActive: true,
            usedAt: null,
            remainingCount: {
              increment: 1,
            },
          },
        });
      }

      if (updatedOrder.usedPackage) {
        await prisma.clientPackages.updateMany({
          where: {
            id: { in: updatedOrder.usedPackage },
            clientId: updatedOrder.userId,
            type: 'MULTIPLE',
          },
          data: {
            isActive: true,
          },
        });
      }

      // Only update client records if the user has a client role
      const client = await prisma.client.findUnique({
        where: { id: updatedOrder.userId },
      });

      if (client) {
        const updatedClient = await prisma.client.update({
          where: { id: updatedOrder.userId },
          data: {
            canceledOrders: {
              increment: 1,
            },
          },
        });

        if (updatedClient.canceledOrders >= settings?.canceledOrder) {
          await prisma.client.update({
            where: { id: updatedOrder.userId },
            data: {
              ban: true,
            },
          });
        }
      }
    });

    return new AppSuccess(updatedOrder, 'Order cancelled successfully');
  }

  async startOrder(id: string) {
    await this.findOneOrFail(id);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.IN_PROGRESS,
        booking: BookingStatus.UPCOMING,
      },
    });

    return new AppSuccess(updatedOrder, 'Order started successfully');
  }

  async completeOrder(id: string) {
    await this.findOneOrFail(id);

    await this.prisma.$transaction(async (prisma) => {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: { status: OrderStatus.COMPLETED, booking: BookingStatus.PAST },
        include: {
          service: {
            include: {
              PackagesServices: {
                select: {
                  id: true,
                },
              },
            },
          },
          client: {
            select: {
              fcmToken: true,
            },
          },
          barber: {
            select: {
              id: true,
              avatar: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await this.notificationService.sendNotification({
        fcmTokens: [updatedOrder.client.fcmToken],
        title: 'Order completed',
        message: 'We hope you had a great experience with us',
        data: {
          orderId: updatedOrder.id,
          barberId: updatedOrder.barber.id,
          barberAvatar: updatedOrder.barber.avatar,
          barberName: `${updatedOrder.barber.firstName} ${updatedOrder.barber.lastName}`,
        },
      });

      const packageServiceIds = updatedOrder.service.flatMap((s) =>
        s.PackagesServices.map((ps) => ps.id),
      );
      if (packageServiceIds.length > 0 && updatedOrder.userId) {
        await this.prisma.packagesServices.deleteMany({
          where: {
            id: { in: packageServiceIds },
            ClientPackages: {
              clientId: updatedOrder?.userId,
            },
            remainingCount: { lt: 1 },
          },
        });
      }

      if (updatedOrder.usedPackage && updatedOrder.userId) {
        await prisma.clientPackages.deleteMany({
          where: {
            id: { in: updatedOrder?.usedPackage },
            clientId: updatedOrder?.userId,
          },
        });
      }
      return new AppSuccess(
        updatedOrder,
        'Order completed successfully, used services removed.',
      );
    });
  }

  async evaluateOrder(
    id: string,
    query?: { discount?: number; points?: number },
  ) {
    const { discount, points } = query ?? {};

    const [currentOrder, settings] = await Promise.all([
      this.prisma.order.findUnique({
        where: {
          id,
          NOT: {
            OR: [
              { status: OrderStatus.PAID },
              {
                status: {
                  in: [
                    OrderStatus.ADMIN_CANCELLED,
                    OrderStatus.CLIENT_CANCELLED,
                    OrderStatus.BARBER_CANCELLED,
                    OrderStatus.CASHIER_CANCELLED,
                  ],
                },
              },
            ],
          },
        },
        select: { subTotal: true, total: true, userId: true },
      }),
      this.prisma.settings.findFirst(),
    ]);

    if (!currentOrder)
      throw new ConflictException('Order is either PAID or cancelled');

    const orderClient = currentOrder.userId
      ? await this.prisma.client.findUnique({
          where: { id: currentOrder.userId },
        })
      : null;

    let total = currentOrder.total;
    let pointsDiscount = 0;
    let discountAmount = 0;

    if (points) {
      if (!settings) throw new NotFoundException('Settings not found');
      const clientPoints = orderClient?.points ?? 0;
      const limitPoints = settings.pointLimit;
      pointsDiscount = this.validatePoints(
        total,
        points,
        clientPoints,
        limitPoints,
      );
      total = total - pointsDiscount;
    }

    if (discount) {
      if (discount < 0)
        throw new BadRequestException('Discount cannot be negative');

      if (discount > 100)
        throw new BadRequestException('Discount cannot be greater than 100%');

      discountAmount = (total * discount) / 100;
      total = total - discountAmount;
    }

    total = Math.max(total, 0);

    return new AppSuccess(
      {
        subTotal: currentOrder.subTotal,
        pointsDiscount: pointsDiscount,
        discountAmount: discountAmount,
        total: total,
      },
      'Order evaluated successfully',
    );
  }

  async paidOrder(id: string, body?: { discount?: number; points?: number }) {
    const { discount, points } = body;
    const [currentOrder, settings] = await Promise.all([
      this.prisma.order.findUnique({
        where: {
          id,
          NOT: {
            OR: [
              { status: OrderStatus.PAID },
              {
                status: {
                  in: [
                    OrderStatus.ADMIN_CANCELLED,
                    OrderStatus.CLIENT_CANCELLED,
                    OrderStatus.BARBER_CANCELLED,
                    OrderStatus.CASHIER_CANCELLED,
                  ],
                },
              },
            ],
          },
        },
        select: {
          subTotal: true,
          total: true,
          client: {
            select: {
              id: true,
              role: true,
              client: { select: { points: true } },
            },
          },
        },
      }),
      this.prisma.settings.findFirst(),
    ]);

    if (!currentOrder)
      throw new ConflictException('Order is either PAID or cancelled');

    const user = currentOrder.client;
    let pointsDiscount = 0;
    let code: PromoCode;
    let total = currentOrder.total;
    let UsedPoints = 0;

    if (points) {
      if (!settings) throw new NotFoundException('Settings not found');
      const clientPoints = user.client.points ?? 0;
      const limitPoints = settings.pointLimit;
      pointsDiscount = this.validatePoints(
        total,
        points,
        clientPoints,
        limitPoints,
      );
      total = total - pointsDiscount;
    }

    if (discount) {
      if (discount < 0)
        throw new BadRequestException('Discount cannot be negative');

      if (discount > 100)
        throw new BadRequestException('Discount cannot be greater than 100%');
      code = await this.promoCodeService
        .createPromoCode({
          code: undefined,
          discount: discount,
          type: 'PERCENTAGE',
          expiredAt: new Date(Date.now() + 60 * 1000),
        })
        .then((res) => res.data);
      total = total - (total * code.discount) / 100;
    }

    await this.findOneOrFail(id);

    if (points) {
      UsedPoints = Math.floor(points / 1000) * 1000;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          client: { update: { points: { decrement: UsedPoints } } },
        },
      });
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PAID,
        booking: 'PAST',
        ...(user.role === 'CASHIER' && { cashierId: user.id }),
        ...(code && {
          promoCode: code.code,
          discount: code.discount,
          type: 'PERCENTAGE',
        }),
        points: UsedPoints ?? 0,
        subTotal: currentOrder.subTotal,
        total,
      },
      include: {
        service: true,
        barber: { select: { firstName: true, lastName: true } },
        branch: { include: {} },
      },
    });

    return new AppSuccess(updatedOrder, 'Order marked as paid');
  }

  async getSlots(date: string, barberId?: string, totalDuration?: number) {
    const EGYPT_TIMEZONE = 'Africa/Cairo';

    // Parse the date string properly - handle both 'T' and space separators
    let dateWithoutTime: string;
    if (date.includes('T')) {
      dateWithoutTime = date.split('T')[0];
    } else if (date.includes(' ')) {
      dateWithoutTime = date.split(' ')[0];
    } else {
      // If it's just a date string, use it as is
      dateWithoutTime = date;
    }

    // Create start and end of day - match how orders are stored
    // Orders are stored as: new Date(dateWithoutTime) which interprets the string as UTC midnight
    // So we need to query for that exact UTC date
    const startOfDay = new Date(`${dateWithoutTime}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateWithoutTime}T23:59:59.999Z`);

    // Create a proper date for vacation checking (just the date part)
    const vacationCheckDate = new Date(dateWithoutTime);

    // Validate the input dates
    if (
      isNaN(vacationCheckDate.getTime()) ||
      isNaN(startOfDay.getTime()) ||
      isNaN(endOfDay.getTime())
    ) {
      console.log('Invalid date detected:', {
        dateWithoutTime,
        vacationCheckDate,
        startOfDay,
        endOfDay,
      });
      return new AppSuccess({ slots: [] }, 'Invalid date provided');
    }

    // If no barberId provided, return empty slots
    if (!barberId) {
      return new AppSuccess({ slots: [] }, 'No barber specified');
    }

    const barber = await this.prisma.barber.findUnique({
      where: {
        id: barberId,
        OR: [
          {
            NOT: {
              vacations: {
                some: {
                  dates: {
                    hasSome: [vacationCheckDate],
                  },
                },
              },
            },
          },
        ],
      },
    });

    console.log('Barber query result:', barber ? 'Found' : 'Not found');

    if (!barber) {
      return new AppSuccess({ slots: [] }, 'Barber not available on this date');
    }

    const [orders, allSlotsData, settings] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          barberId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          deleted: false,
          booking: {
            in: [BookingStatus.UPCOMING],
          },
          status: {
            notIn: [
              OrderStatus.ADMIN_CANCELLED,
              OrderStatus.CLIENT_CANCELLED,
              OrderStatus.BARBER_CANCELLED,
              OrderStatus.CASHIER_CANCELLED,
            ],
          },
        },
        select: {
          id: true,
          date: true,
          slot: true,
          booking: true,
          status: true,
          service: { select: { duration: true } },
        },
      }),
      this.prisma.barber.findUnique({
        where: {
          id: barberId,
        },
        select: {
          Slot: {
            select: { slot: true, updatedSlot: true, effectiveSlotDate: true },
          },
        },
      }),

      this.prisma.settings.findFirst({
        select: { slotDuration: true },
      }),
    ]);

    if (!allSlotsData) {
      throw new ConflictException('No slots found in the database.');
    }

    if (!allSlotsData.Slot) {
      console.log('No slot configuration found for barber');
      return new AppSuccess(
        { slots: [] },
        'No slots configured for this barber',
      );
    }

    const todayInEgypt = toZonedTime(new Date(), EGYPT_TIMEZONE)
      .toISOString()
      .split('T')[0];
    const { effectiveSlotDate, updatedSlot, slot } = allSlotsData.Slot;

    console.log('Slot data:', {
      slot: slot?.length || 0,
      updatedSlot: updatedSlot?.length || 0,
      effectiveSlotDate,
      todayInEgypt,
      dateWithoutTime,
    });

    const effectiveSlotDateWithoutTime = effectiveSlotDate
      ? toZonedTime(effectiveSlotDate, EGYPT_TIMEZONE)
          .toISOString()
          .split('T')[0]
      : null;

    let allSlots: string[] = slot || [];

    // Check if barber has any slots at all
    if (!slot || slot.length === 0) {
      console.log('No working hours configured for barber');
      return new AppSuccess(
        { slots: [] },
        'No working hours configured for this barber',
      );
    }

    if (
      effectiveSlotDateWithoutTime &&
      dateWithoutTime >= effectiveSlotDateWithoutTime &&
      updatedSlot &&
      updatedSlot.length > 0
    ) {
      allSlots = updatedSlot;
    }

    if (
      effectiveSlotDateWithoutTime &&
      todayInEgypt >= effectiveSlotDateWithoutTime
    ) {
      // Only update if updatedSlot is not empty
      if (updatedSlot && updatedSlot.length > 0) {
        const newSlots = await this.prisma.slot.update({
          where: { barberId },
          data: {
            slot: updatedSlot,
            effectiveSlotDate: null,
            updatedSlot: [],
          },
        });
        allSlots = newSlots.slot;
      } else {
        // Just clear the effective date without changing slots
        await this.prisma.slot.update({
          where: { barberId },
          data: {
            effectiveSlotDate: null,
            updatedSlot: [],
          },
        });
      }
    }

    const blockedSlots = [];

    // Get slot duration from settings for proper conversion
    const slotDurationMinutes = settings?.slotDuration || 15;

    for (const order of orders) {
      const startIndex = allSlots.indexOf(order.slot);
      if (startIndex === -1) continue;

      // Calculate total duration in minutes
      const totalDurationMinutes = order.service.reduce(
        (sum, s) => sum + s.duration,
        0,
      );

      // Convert to number of slots needed
      const slotsNeeded = Math.ceil(totalDurationMinutes / slotDurationMinutes);

      // Block all consecutive slots needed for this order
      allSlots
        .slice(startIndex, startIndex + slotsNeeded)
        .forEach((slot) => blockedSlots.push(slot));
    }

    let availableSlots = allSlots.filter(
      (slot) => !blockedSlots.includes(slot),
    );

    // Filter out past slots dynamically based on current time in Egypt
    const currentTimeInEgypt = toZonedTime(new Date(), EGYPT_TIMEZONE);
    const todayDate = currentTimeInEgypt.toISOString().split('T')[0];
    const currentHour = currentTimeInEgypt.getHours();
    const currentMinute = currentTimeInEgypt.getMinutes();

    // Apply time filtering for today's slots
    if (dateWithoutTime === todayDate) {
      availableSlots = availableSlots.filter((slot) => {
        // Parse slot time (e.g., "10:00 AM" or "02:30 PM")
        const slotTime = this.parseSlotTime(slot);
        if (!slotTime) {
          return true; // Keep slot if parsing fails
        }

        const slotTotalMinutes = slotTime.hour * 60 + slotTime.minute;
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        // Show slots that haven't started yet (any future slot)
        // No buffer needed - clients can book up until the slot time
        const isSlotAvailable = slotTotalMinutes > currentTotalMinutes;

        return isSlotAvailable;
      });
    }

    // Filter slots based on total duration if provided
    if (totalDuration && totalDuration > settings.slotDuration) {
      // Reuse slotDurationMinutes from above
      const durationInSlots = Math.ceil(totalDuration / slotDurationMinutes);

      // Only return slots where barber has consecutive availability
      const validStartSlots = availableSlots.filter((slot) => {
        const startIndex = allSlots.indexOf(slot);
        if (startIndex === -1) return false;

        // Check if we have enough consecutive slots starting from this slot
        for (let i = 0; i < durationInSlots; i++) {
          const requiredSlotIndex = startIndex + i;

          // Check if the required slot index is within bounds
          if (requiredSlotIndex >= allSlots.length) {
            return false; // Not enough slots remaining in the day
          }

          const requiredSlot = allSlots[requiredSlotIndex];
          if (!requiredSlot || !availableSlots.includes(requiredSlot)) {
            return false; // Required slot is not available
          }
        }
        return true;
      });
      // If no barber has enough consecutive time, return empty array
      if (validStartSlots.length === 0) {
        return new AppSuccess(
          { slots: [] },
          `Barber doesn't have ${totalDuration} minutes of consecutive time available`,
        );
      }

      availableSlots = validStartSlots;
    }

    console.log('Final result:', {
      totalSlots: allSlots.length,
      blockedSlots: blockedSlots.length,
      availableSlots: availableSlots.length,
      slots: availableSlots,
    });

    return new AppSuccess(
      { slots: availableSlots },
      'Slots fetched successfully',
    );
  }

  private parseSlotTime(slot: string): { hour: number; minute: number } | null {
    try {
      // Parse slots like "10:00 AM", "02:30 PM", etc.
      const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const match = slot.match(timeRegex);

      if (!match) return null;

      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const period = match[3].toUpperCase();

      // Convert to 24-hour format
      if (period === 'AM') {
        if (hour === 12) hour = 0; // 12:00 AM = 00:00
      } else {
        // PM
        if (hour !== 12) hour += 12; // Add 12 for PM (except 12:00 PM)
      }

      return { hour, minute };
    } catch (error) {
      console.error(`Error parsing slot time "${slot}":`, error);
      return null;
    }
  }

  async generateSlot(start: number, end: number) {
    const slotsArray = [];

    const settings = await this.prisma.settings.findFirst({});

    console.log('settings', settings);

    for (let hour = start; hour < end; hour++) {
      for (let minute = 0; minute < 60; minute += settings.slotDuration) {
        const slot = `${hour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')}`;
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
      const slots = await this.prisma.slot.create({
        data: {
          start,
          end,
          slot: slotsArray,
        },
      });

      return new AppSuccess(slots, 'Slots created successfully');
    }

    const findFirst = await this.prisma.slot.findFirst();
    const slots = await this.prisma.slot.update({
      where: { id: findFirst.id },
      data: {
        start,
        end,
        slot: slotsArray,
      },
    });

    return new AppSuccess(slots, 'Slots updated successfully');
  }

  async findOneOrFail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        service: true,
        barber: { include: { barber: true } },
        client: true,
      },
    });
    if (!order) {
      throw new ConflictException(`Order with ID "${id}" not found`);
    }

    const { client, ...rest } = order;

    return {
      ...rest,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phone,
    };
  }

  private validatePoints(
    total: number,
    points: number,
    clientPoints: number,
    limitPoints: number,
  ) {
    if (points < 0) throw new BadRequestException('Points cannot be negative');
    if (!Number.isInteger(points))
      throw new BadRequestException('Points must be a whole number');

    if (points < 0) throw new BadRequestException('Points cannot be negative');

    if (!Number.isInteger(Number(points)))
      throw new BadRequestException('Points must be a whole number');

    if (points < limitPoints)
      throw new BadRequestException(
        `Minimum points required is ${limitPoints} points`,
      );

    if (points > (clientPoints ?? 0))
      throw new BadRequestException('Client does not have enough points');
    const maxPointsDiscount = total * 0.4; // 40% of total
    const pointsDiscount = Math.floor(points / 1000) * 50;

    if (pointsDiscount > maxPointsDiscount) {
      throw new BadRequestException(
        `Points discount cannot exceed 40% of total (${maxPointsDiscount})`,
      );
    }

    return pointsDiscount;
  }

  private slotToDatetime(dateWithoutTime: string, slot: string): Date {
    const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const pad = (n: number) => String(n).padStart(2, '0');

    if (!match) {
      return fromZonedTime(
        new Date(`${dateWithoutTime}T00:00:00`),
        EGYPT_TIMEZONE,
      );
    }

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;

    return fromZonedTime(
      new Date(`${dateWithoutTime}T${pad(hour)}:${pad(minute)}:00`),
      EGYPT_TIMEZONE,
    );
  }
}
