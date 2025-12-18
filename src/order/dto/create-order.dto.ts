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
import { OrderStatus, BookingStatus } from '@prisma/client';

export class CreateOrderDto {
  @IsOptional()
  userId: string;

  @IsOptional()
  @IsString()
  @Length(10, 16)
  phone: string;

  @IsString()
  date: Date;

  @IsString()
  slot: string;

  @IsOptional()
  @IsUUID()
  barberId?: string;

  @IsOptional()
  @IsString()
  barberName?: string;

  @ValidateIf((d) => !d.package && !d.service)
  @IsArray()
  @IsString({ each: true })
  service: string[];

  @ValidateIf((d) => !d.package && !d.service)
  @IsArray()
  @IsString({ each: true })
  packages: string[];

  @IsOptional()
  @IsUUID()
  branchId: string;

  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  note?: string;

  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsInt()
  @Min(0)
  points?: number;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsArray()
  usedPackage?: string[];

  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsEnum(BookingStatus)
  booking?: BookingStatus;
}
