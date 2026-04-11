import { BadRequestException, Global, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReferralCodeService {
  constructor(private prisma: PrismaService) {}

  public async checkReferralCode(referralCode: string) {
    try {
      if (!referralCode || referralCode.trim() === '') {
        throw new BadRequestException('Referral code cannot be empty');
      }
      const user = await this.prisma.client.findFirst({
        where: { referralCode },
        select: {
          referralCode: true,
          ban: true,
          id: true,
        },
      });
      console.log(referralCode);
      if ((referralCode && !user) || (user && user.ban)) {
        throw new BadRequestException('Invalid referral code or not exist');
      }

      return { status: true, user };
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Invalid referral code or not exist');
    }
  }

  public async handleReferralCode(
    tx: Prisma.TransactionClient,
    id: string,
    referralCode: string,
  ) {
    try {
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
    } catch (err) {
      console.log(err);

      throw new BadRequestException('Error handling referral code');
    }
  }
}
