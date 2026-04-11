import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PromoCodeService } from './promo-code.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { RolesGuard } from '../../guard/role.guard';
import { AuthGuard } from '../../guard/auth.guard';

@UseGuards(AuthGuard(), RolesGuard)
@Controller('promo-code')
export class PromoCodeController {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  @Post()
  create(@Body() createPromoCodeDto: CreatePromoCodeDto) {
    return this.promoCodeService.createPromoCode(createPromoCodeDto);
  }

  @Get()
  findAll() {
    return this.promoCodeService.getAllPromoCode();
  }

  @Post('/valid-promo-code')
  async validatePromoCode(@Body('code') code: string) {
    return this.promoCodeService.validatePromoCode(code);
  }

  @Delete('/:id')
  async deletePromoCode(@Param('id') id: string) {
    return this.promoCodeService.deletePromoCode(id);
  }
}
