import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  Length,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { translationDto } from '../../../class-type/translation';

export class CreateBranchDto {
  @ApiProperty({ example: '123 Main St, Cairo' })
  @IsString()
  location: string;

  @ApiProperty({ example: '01012345678' })
  @IsNotEmpty()
  @IsString()
  @Length(10, 16)
  phone: string;

  @ApiProperty({ example: '30.0444' })
  @IsString()
  latitude: string;

  @ApiProperty({ example: '31.2357' })
  @IsString()
  longitude: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsInt()
  @Min(0)
  @Max(10)
  rate?: number;

  @ApiProperty({ type: [translationDto] })
  @IsArray()
  Translation: translationDto[];
}
