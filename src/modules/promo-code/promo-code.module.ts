import { Module } from '@nestjs/common';
import { PromoCodeService } from './promo-code.service';
import { PromoCodeController } from './promo-code.controller';
import { PromoCodeQueryService } from './services/promo-code-query.service';
import { PromoCodeMutationService } from './services/promo-code-mutation.service';

@Module({
  controllers: [PromoCodeController],
  providers: [
    PromoCodeService,
    PromoCodeQueryService,
    PromoCodeMutationService,
  ],
  exports: [PromoCodeService],
})
export class PromoCodeModule {}
