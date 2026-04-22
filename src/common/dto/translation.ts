import { PartialType } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class TranslationType {
  @IsString()
  id?: string;

  @IsString()
  @Transform(({ value }) => value ?? null)
  name!: string;

  @IsString()
  @Transform(({ value }) => Language[value.toUpperCase()] ?? null)
  language!: Language;

  @IsString()
  @Transform(({ value }) => value ?? null)
  @IsOptional()
  description?: string;
}

export class UpdateTranslationDto extends PartialType(TranslationType) {}
