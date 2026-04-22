import { Injectable } from '@nestjs/common';
import { CreatePromoCodeDto } from '../dto/create-promo-code.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AppSuccess } from 'src/utils/AppSuccess';
import { PromoCode } from '@prisma/client';
import { Random } from 'src/utils/generate';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PromoCodeMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async createPromoCode(
    createPromoCodeDto: CreatePromoCodeDto,
  ): Promise<AppSuccess<PromoCode>> {
    const { code, ...reset } = createPromoCodeDto;

    const promoCode = code ?? Random(6);

    const newPromoCode = await this.prisma.promoCode.create({
      data: {
        ...reset,
        code: promoCode,
        expiredAt: new Date(reset.expiredAt),
      },
    });
    return new AppSuccess(newPromoCode, 'Promo code created successfully');
  }

  async deletePromoCode(id: string): Promise<AppSuccess<PromoCode>> {
    const promoCode = await this.prisma.promoCode.delete({
      where: {
        id,
      },
    });

    return new AppSuccess(promoCode, 'Promo code deleted successfully');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async removeExpiredPromoCodes() {
    const result = await this.prisma.promoCode.findMany({
      where: {
        expiredAt: {
          lt: new Date(),
        },
      },
    });

    if (result.length > 0) {
      await this.prisma.promoCode.deleteMany({
        where: {
          expiredAt: {
            lt: new Date(),
          },
        },
      });
    }
  }
}
