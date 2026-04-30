import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromoCodeService } from './promo-code.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { RolesGuard } from '../../common/guard/role.guard';
import { AuthGuard } from '../../common/guard/auth.guard';
import {
  CreatePromoCodeDoc,
  GetAllPromoCodesDoc,
  ValidatePromoCodeDoc,
  DeletePromoCodeDoc,
} from './promo-code.swagger';

@ApiTags('Promo Code')
@UseGuards(AuthGuard(), RolesGuard)
@Controller('promo-code')
export class PromoCodeController {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  @Post()
  @CreatePromoCodeDoc()
  create(@Body() createPromoCodeDto: CreatePromoCodeDto) {
    return this.promoCodeService.createPromoCode(createPromoCodeDto);
  }

  @Get()
  @GetAllPromoCodesDoc()
  findAll() {
    return this.promoCodeService.getAllPromoCode();
  }

  @Post('/valid-promo-code')
  @ValidatePromoCodeDoc()
  async validatePromoCode(@Body('code') code: string) {
    return this.promoCodeService.validatePromoCode(code);
  }

  @Delete('/:id')
  @DeletePromoCodeDoc()
  async deletePromoCode(@Param('id') id: string) {
    return this.promoCodeService.deletePromoCode(id);
  }
}
