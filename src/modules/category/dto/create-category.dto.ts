import { CategoryType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { translationDto } from '../../../common/class-type/translation';

export class CreateCategoryDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  available: boolean;

  @ApiPropertyOptional({ enum: CategoryType, example: CategoryType.GENERAL })
  @IsEnum(CategoryType)
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toUpperCase())
  type: CategoryType;

  @ApiProperty({ type: [translationDto] })
  @IsArray()
  Translation: translationDto[];
}
