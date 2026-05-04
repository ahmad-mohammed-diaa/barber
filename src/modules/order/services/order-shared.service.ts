import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PromoCode, Service } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromoCodeService } from '../../promo-code/promo-code.service';
import { OrderPricingService } from './order-pricing.service';

export interface ServiceWithFreeFlag extends Service {
  isFree: boolean;
}

export interface PricingResult {
  subTotal: number;
  pointsDiscount: number;
  discount: number;
  total: number;
}

@Injectable()
export class OrderSharedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promoCodeService: PromoCodeService,
    private readonly orderPricing: OrderPricingService,
  ) {}

  async resolveUserId(
    phone: string | undefined,
    userId: string,
  ): Promise<string> {
    if (!phone || phone === '') return userId;
    const user = await this.prisma.user.findUnique({ where: { phone } });
    return user ? user.id : userId;
  }

  async fetchServices(serviceIds: string[]) {
    const fetchedServices = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });
    const totalDuration = fetchedServices.reduce(
      (acc, s) => acc + s.duration,
      0,
    );
    return { fetchedServices, totalDuration };
  }

  async fetchSlots(
    barberId: string | undefined,
    dateWithoutTime: string,
    totalDuration: number,
  ): Promise<string[]> {
    if (!barberId) return [];
    return (
      await this.orderPricing.getSlots(dateWithoutTime, barberId, totalDuration)
    ).slots;
  }

  async validatePromoCode(promoCode: string | undefined) {
    if (!promoCode) return false;
    return (await this.promoCodeService.validatePromoCode(promoCode)).data;
  }

  async resolveServiceList(
    userId: string,
    role: string | undefined,
    fetchedServices: Service[],
    usedPackage: string[] | undefined,
  ): Promise<{
    allServices: ServiceWithFreeFlag[];
    costServices: ServiceWithFreeFlag[];
  }> {
    const allServices: ServiceWithFreeFlag[] = [];

    if (role === 'USER') {
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
          packageService: { select: { service: true } },
        },
      });

      if (clientPackages.length === 0) {
        allServices.push(
          ...fetchedServices.map((srv) => ({ ...srv, isFree: false })),
        );
      } else {
        const selectedPackage = clientPackages.filter((pkg) =>
          usedPackage?.includes(pkg.id),
        );
        const notValidPackage = selectedPackage.filter((pkg) => !pkg.isActive);
        if (notValidPackage.length > 0)
          throw new BadRequestException('This package is not valid anymore');

        const single = clientPackages
          .filter((pkg) => pkg.type === 'SINGLE' && pkg.isActive)
          .flatMap((pkg) =>
            pkg.packageService.flatMap((ps) => ({
              ...ps.service,
              pkgId: pkg.id,
            })),
          );

        allServices.push(
          ...fetchedServices.map((srv) => ({
            ...srv,
            isFree: single.some((s) => s.id === srv.id),
          })),
        );

        for (const pkg of selectedPackage) {
          if (pkg.type === 'SINGLE')
            throw new ConflictException(
              'Can not select Packages of type SINGLE',
            );
          allServices.push(
            ...pkg.packageService.flatMap((ps) => ({
              ...ps.service,
              isFree: true,
            })),
          );
        }
      }
    } else {
      allServices.push(
        ...fetchedServices.map((srv) => ({ ...srv, isFree: false })),
      );
    }

    const costServices = allServices.filter((s) => !s.isFree);
    return { allServices, costServices };
  }

  calculatePricing(
    costServices: ServiceWithFreeFlag[],
    points: number | undefined,
    usedPromoCode: { client?: { points?: number } } | null,
    validPromoCode: PromoCode | null | false,
  ): PricingResult {
    const subTotal = costServices.reduce((acc, s) => acc + s.price, 0);

    let pointsDiscount = 0;
    if (points) {
      if (points < 1000)
        throw new BadRequestException('Minimum points required is 1000');
      if (points > (usedPromoCode?.client?.points ?? 0))
        throw new BadRequestException('You do not have enough points');
      pointsDiscount = Math.floor(points / 1000) * 50;
      if (pointsDiscount > subTotal)
        throw new BadRequestException(
          'Points discount cannot exceed the subtotal',
        );
    }

    const discount = validPromoCode
      ? validPromoCode.type === 'PERCENTAGE'
        ? (subTotal * validPromoCode.discount) / 100
        : validPromoCode.discount
      : 0;

    const total = Math.max(subTotal - discount - pointsDiscount, 0);
    return { subTotal, pointsDiscount, discount, total };
  }

  buildDiscountDisplay(
    validPromoCode: PromoCode | null | false,
    pointsDiscount: number,
    discount: number,
  ): string {
    if (validPromoCode && pointsDiscount > 0) {
      return validPromoCode.type === 'PERCENTAGE'
        ? `${validPromoCode.discount}% + ${pointsDiscount}EGP`
        : `${discount}EGP + ${pointsDiscount}EGP`;
    }
    if (validPromoCode) {
      return validPromoCode.type === 'PERCENTAGE'
        ? `${validPromoCode.discount}%`
        : `${validPromoCode.discount}EGP`;
    }
    return pointsDiscount > 0 ? `${pointsDiscount}EGP` : '0';
  }
}
