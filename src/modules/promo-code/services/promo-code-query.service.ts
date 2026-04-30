import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import { PromoCode } from '@prisma/client';

@Injectable()
export class PromoCodeQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllPromoCode(): Promise<AppSuccess<{ promoCode: PromoCode[] }>> {
    const promoCode = await this.prisma.promoCode.findMany();
    return new AppSuccess({ promoCode }, 'Promo code list');
  }

  async validatePromoCode(promoCode: string): Promise<AppSuccess<PromoCode>> {
    const validPromoCode = await this.prisma.promoCode.findFirst({
      where: {
        code: promoCode,
        expiredAt: {
          gte: new Date(),
        },
      },
    });

    if (!validPromoCode) {
      throw new ConflictException(
        `Promo code ${promoCode} is invalid or expired.`,
      );
    }

    return new AppSuccess(validPromoCode, 'Promo code is valid');
  }
}
