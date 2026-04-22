import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReferralCodeService {
  private readonly logger = new Logger(ReferralCodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async checkReferralCode(referralCode: string) {
    if (!referralCode || referralCode.trim() === '') {
      throw new BadRequestException('Referral code cannot be empty');
    }

    const user = await this.prisma.client.findFirst({
      where: { referralCode },
      select: { referralCode: true, ban: true, id: true },
    });

    if (!user || user.ban) {
      throw new BadRequestException('Invalid referral code or not exist');
    }

    return { status: true, user };
  }

  public async handleReferralCode(
    tx: Prisma.TransactionClient,
    id: string,
    referralCode: string,
  ) {
    const settings = await tx.settings.findFirst({});
    if (!settings || !settings.referralPoints) {
      throw new BadRequestException('Referral points setting not found');
    }

    await this.checkReferralCode(referralCode);

    const user = await tx.user.update({
      where: { id },
      data: { client: { update: { points: settings.referralPoints } } },
    });

    await tx.client.update({
      where: { referralCode },
      data: { points: { increment: settings.referralPoints } },
    });

    return user;
  }
}
