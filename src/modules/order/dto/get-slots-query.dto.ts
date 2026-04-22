import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GetSlotsQueryDto {
  @ApiProperty({ example: '2025-06-15' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ example: 'uuid-barber-id' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  totalDuration?: number;
}
