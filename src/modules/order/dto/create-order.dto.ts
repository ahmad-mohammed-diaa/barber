import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
  ValidateIf,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, BookingStatus } from '@prisma/client';

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'uuid-user-id' })
  @IsOptional()
  userId: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  @Length(10, 16)
  phone: string;

  @ApiProperty({ example: '2025-06-15' })
  @IsString()
  date: Date;

  @ApiProperty({ example: '10:00 AM' })
  @IsString()
  slot: string;

  @ApiPropertyOptional({ example: 'uuid-barber-id' })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiPropertyOptional({ example: 'Ahmed' })
  @IsOptional()
  @IsString()
  barberName?: string;

  @ApiPropertyOptional({ type: [String], example: ['uuid-service-id'] })
  @ValidateIf((d) => !d.package && !d.service)
  @IsArray()
  @IsString({ each: true })
  service: string[];

  @ApiPropertyOptional({ type: [String], example: ['uuid-package-id'] })
  @ValidateIf((d) => !d.package && !d.service)
  @IsArray()
  @IsString({ each: true })
  packages: string[];

  @ApiPropertyOptional({ example: 'uuid-branch-id' })
  @IsOptional()
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ example: 'Please be on time' })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional({ example: 'PROMO10' })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({ type: [String], example: ['uuid-client-package-id'] })
  @IsOptional()
  @IsArray()
  usedPackage?: string[];

  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.PENDING })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: BookingStatus, example: BookingStatus.UPCOMING })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsEnum(BookingStatus)
  booking?: BookingStatus;
}
