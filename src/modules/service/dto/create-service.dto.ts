import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { translationDto } from '../../../common/class-type/translation';

export class CreateServiceDto {
  @ApiProperty({ example: 150 })
  @ValidateIf(
    (obj) => typeof obj.duration === 'string' || typeof obj.duration === 'number',
  )
  @IsNotEmpty()
  @Transform(({ value }) => +value)
  price: number;

  @ApiProperty({ example: 30 })
  @ValidateIf(
    (obj) => typeof obj.duration === 'string' || typeof obj.duration === 'number',
  )
  @IsNotEmpty()
  @Transform(({ value }) => +value)
  duration: number;

  @ApiProperty({ example: 'uuid-category-id' })
  @ValidateIf(
    (obj) => typeof obj.duration === 'string' || typeof obj.duration === 'number',
  )
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  available: boolean;

  @ApiProperty({ type: [translationDto] })
  @IsArray()
  Translation: translationDto[];
}
