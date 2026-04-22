import { Injectable } from '@nestjs/common';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PromoCodeQueryService } from './services/promo-code-query.service';
import { PromoCodeMutationService } from './services/promo-code-mutation.service';

@Injectable()
export class PromoCodeService {
  constructor(
    private readonly promoCodeQuery: PromoCodeQueryService,
    private readonly promoCodeMutation: PromoCodeMutationService,
  ) {}

  createPromoCode(createPromoCodeDto: CreatePromoCodeDto) {
    return this.promoCodeMutation.createPromoCode(createPromoCodeDto);
  }

  getAllPromoCode() {
    return this.promoCodeQuery.getAllPromoCode();
  }

  validatePromoCode(promoCode: string) {
    return this.promoCodeQuery.validatePromoCode(promoCode);
  }

  deletePromoCode(id: string) {
    return this.promoCodeMutation.deletePromoCode(id);
  }
}
