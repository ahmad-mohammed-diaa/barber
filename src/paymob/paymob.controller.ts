import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import * as fs from 'fs';

import { PaymobService } from './paymob.service';
import { Response } from 'express';
import { config } from 'dotenv';
import { Language, User } from '@prisma/client';
import { AuthGuard } from '../../guard/auth.guard';
import { UserData } from '../../decorators/user.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePaymobDto } from './dto/create-paymob.dto';
import { join } from 'path';
import { Lang } from '../../decorators/accept.language';
import { Translation } from 'src/class-type/translation';

config();

@Controller('paymob')
export class PaymobController {
  private readonly IntegrationIds = {
    card: process.env.PAYMOB_CARD_INTEGRATION_ID,
    wallet: process.env.PAYMOB_WALLET_INTEGRATION_ID,
  };

  constructor(
    private readonly paymobService: PaymobService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(AuthGuard())
  @Post('payment-key')
  async getPaymentKey(
    @Body() body: CreatePaymobDto,
    @UserData('user') user: User,
    @Res() res: Response,
    @Lang() lang: Language,
  ) {
    const { item: id } = body;
    const { firstName, lastName, phone } = user;

    const offers = await this.prisma.offers.findUnique({
      where: {
        id,
      },
      select: {
        offerType: true,
        packages: {
          select: {
            ...Translation(true, lang),
            price: true,
          },
        },
        points: {
          select: {
            ...Translation(true, lang),
            price: true,
          },
        },
      },
    });

    const type = offers.offerType.toLocaleLowerCase();

    const item = [
      {
        name: offers[type].Translation[0].name,
        amount: offers[type].price * 100,
        description:
          offers[type].Translation[0].description ??
          offers[type].Translation[0].name,
        quantity: 1,
      },
    ];

    const billing_data = {
      first_name: firstName,
      last_name: lastName,
      phone_number: `+2${phone}`,
    };

    const paymentKey = await this.paymobService.getPaymentKey(
      billing_data,
      item,
      id,
      offers[type].price,
    );
    return res.redirect(paymentKey);
  }

  @Get('verify')
  async verifyPaymobQuery(
    @Query() query: any,
    // @UserData('user') user: User,
    @Res() res: Response,
    @Lang() lang: Language,
  ) {
    const authToken = await this.paymobService.getAuthToken();
    const user = { id: 'c1b8c002-0a74-455e-be5d-bd3aca12ab3b' } as User;
    const isSuccess = this.paymobService.verifyPaymobQuery(
      query,
      authToken,
      user,
      res,
      lang,
    );

    res.redirect('api/paymob/config/transaction-status');

    // let page = fs.readFileSync('config/transaction-status.html', 'utf-8');
    // page = page.replace(
    //   `{{ isSuccess }}`,
    //   JSON.stringify(isSuccess.toString()),
    // );
    // res.send(page);
  }

  @Get('config/transaction-status')
  test(@Res() res: Response) {
    const isSuccess = false;

    // res.redirect('/config/transaction-status.html');

    let page = fs.readFileSync('config/transaction-status.html', 'utf-8');
    // page = page.replace('{{ .Success }}', isSuccess.toString());
    res.send(page);
  }
}
