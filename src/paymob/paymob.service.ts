import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';
import { ClientPackagesService } from '../modules/client-packages/client-packages.service';
import { Language, User } from '@prisma/client';
import { PointsService } from '../modules/points/points.service';
import { Response } from 'express';
import { join } from 'path';

@Injectable()
export class PaymobService {
  private readonly paymobBaseUrl = 'https://accept.paymob.com/api';
  private readonly apiKey = process.env.PAYMOB_API_KEY;

  constructor(
    private readonly points: PointsService,
    private readonly packages: ClientPackagesService,
    private readonly prisma: PrismaService,
  ) {}

  async getAuthToken() {
    const response = await axios.post(`${this.paymobBaseUrl}/auth/tokens`, {
      api_key: this.apiKey,
    });

    return response.data.token;
  }

  async getPaymentKey(
    billing_data: {
      first_name: string;
      last_name: string;
      phone_number: string;
    },
    items: {
      name: string;
      amount: number;
      description: string;
      quantity: number;
    }[],
    id: string,
    amount: number,
  ) {
    const { first_name, last_name, phone_number } = billing_data;

    try {
      const response = await axios.post(
        'https://accept.paymob.com/v1/intention',
        {
          amount: amount * 100,
          currency: 'EGP',
          payment_methods: [
            +process.env.PAYMOB_CARD_INTEGRATION_ID,
            +process.env.PAYMOB_WALLET_INTEGRATION_ID,
          ],
          items: [...items],
          billing_data: {
            apartment: 'dumy',
            first_name,
            last_name,
            street: 'dumy',
            building: 'dumy',
            phone_number,
            city: 'dumy',
            country: 'dumy',
            email: 'test@gmail.com',
            floor: 'dumy',
            state: 'dumy',
          },
          extras: {
            order_id: id,
          },

          // redirection_url: 'https://www.google.com/',
        },
        {
          headers: {
            Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      const clientSecret = response.data.client_secret;

      return `https://uae.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;
    } catch (error) {}
  }

  async verifyPaymobQuery(
    payload: any,
    auth_token: string,
    user: User,
    res: Response,
    lang: Language,
  ) {
    const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

    const providedHmac = payload.hmac;
    delete payload.hmac;

    const orderedValues = [
      payload.amount_cents,
      payload.created_at,
      payload.currency,
      payload.error_occured,
      payload.has_parent_transaction,
      payload.id,
      payload.integration_id,
      payload.is_3d_secure,
      payload.is_auth,
      payload.is_capture,
      payload.is_refunded,
      payload.is_standalone_payment,
      payload.is_voided,
      payload.order,
      payload.owner,
      payload.pending,
      payload['source_data.pan'],
      payload['source_data.sub_type'],
      payload['source_data.type'],
      payload.success,
    ];

    const concatenatedString = orderedValues.join('');

    const generatedHmac = crypto
      .createHmac('sha512', PAYMOB_HMAC_SECRET)
      .update(concatenatedString)
      .digest('hex');

    const success =
      generatedHmac === providedHmac && payload.success === 'true';

    if (success) {
      const response = await axios.post(
        'https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry',
        {
          auth_token,
          order_id: payload.order,
        },
      );
      const packageId = response.data.payment_key_claims.extra.order_id;

      const offer = await this.prisma.offers
        .findUnique({
          where: {
            id: packageId,
          },
          select: {
            offerType: true,
          },
        })
        .catch(() => {
          throw new HttpException('Package not found', HttpStatus.NOT_FOUND);
        });

      const type = offer.offerType.toLowerCase();

      if (type === 'packages') {
        // await this.packages.create(packageId, user, lang);
      } else if (type === 'points') {
        const a = await this.points.create(packageId, user, lang);
      }
    }

    // Redirect to the HTML file with the success status
    const redirectUrl = join('transaction-status.html');
    res.sendFile(redirectUrl, { root: '.' });

    return success;
  }

  return(res: Response) {
    const redirectUrl = join(__dirname, 'transaction-status.html');
    res.sendFile(redirectUrl);
  }
}
