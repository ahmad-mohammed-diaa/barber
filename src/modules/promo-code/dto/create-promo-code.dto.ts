import { PromoType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePromoCodeDto {
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsNumber()
  discount: number;

  @IsNotEmpty()
  @IsEnum(PromoType)
  type: PromoType;

  @IsNotEmpty()
  expiredAt: Date;
}
