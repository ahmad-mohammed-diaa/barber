import { CategoryType, Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class Vacation {
  @ApiPropertyOptional()
  @IsString()
  id: string;

  @ApiProperty({ type: [String], example: ['2024-12-25'] })
  @IsArray()
  @IsNotEmpty()
  dates: string[];

  @ApiProperty({ example: '2024-12' })
  @IsString()
  month: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Ahmad' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Hassan' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  avatar: string;

  @ApiProperty({ example: '01234567890' })
  @IsNotEmpty()
  @IsString()
  @Length(10, 16)
  phone: string;

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  referralCode: string;

  @ApiPropertyOptional({ enum: Role, example: Role.USER })
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  role: Role;

  @ApiPropertyOptional({ example: 'branch-uuid' })
  @ValidateIf(
    (object) =>
      object?.role?.toUpperCase() === 'CASHIER' ||
      object?.role?.toUpperCase() === 'BARBER',
  )
  @Transform(({ value }) => value ?? null)
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @ApiPropertyOptional({ type: [Vacation] })
  @IsArray()
  @IsOptional()
  @ValidateIf((o) => ['CASHIER', 'BARBER'].includes(o?.role?.toUpperCase()))
  vacations: Vacation[];

  @ApiPropertyOptional({ example: 9 })
  @ValidateIf((o) => ['CASHIER', 'BARBER'].includes(o?.role?.toUpperCase()))
  @Transform(({ value }) => {
    const num = Number(value);
    return !Number.isNaN(num) ? num : undefined;
  })
  @IsNotEmpty({ message: 'Start time is required' })
  @IsInt({ message: 'Start must be a whole number' })
  start: number;

  @ApiPropertyOptional({ enum: CategoryType })
  @ValidateIf((o) => ['BARBER'].includes(o?.role?.toUpperCase()))
  @IsNotEmpty({ message: 'Type is required' })
  @Transform(({ value }: { value: string }) => value?.toUpperCase())
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiPropertyOptional({ example: 18 })
  @ValidateIf((o) => ['CASHIER', 'BARBER'].includes(o?.role?.toUpperCase()))
  @Transform(({ value }) => {
    const num = Number(value);
    return !Number.isNaN(num) ? num : undefined;
  })
  @IsNotEmpty({ message: 'End time is required' })
  @IsInt({ message: 'End must be a whole number' })
  end: number;
}
