import { CategoryType, Role } from '@prisma/client';
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

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  avatar: string;

  @IsNotEmpty()
  @IsString()
  @Length(10, 16)
  phone: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  referralCode: string;

  @IsOptional()
  @Transform(({ value }) => value ?? null)
  @IsString()
  role: Role;

  @ValidateIf(
    (object) =>
      object?.role?.toUpperCase() === 'CASHIER' ||
      object?.role?.toUpperCase() === 'BARBER',
  )
  @Transform(({ value }) => value ?? null)
  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsArray()
  @IsOptional()
  @ValidateIf((o) => ['CASHIER', 'BARBER'].includes(o?.role?.toUpperCase()))
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  vacations: Vacation[];

  @ValidateIf((o) => ['CASHIER', 'BARBER'].includes(o?.role?.toUpperCase()))
  @Transform(({ value }) => {
    const num = Number(value);
    return !Number.isNaN(num) ? num : undefined;
  })
  @IsNotEmpty({ message: 'Start time is required' })
  @IsInt({ message: 'Start must be a whole number' })
  start: number;

  @ValidateIf((o) => ['BARBER'].includes(o?.role?.toUpperCase()))
  @IsNotEmpty({ message: 'Type is required' })
  @Transform(({ value }: { value: string }) => value?.toUpperCase())
  @IsEnum(CategoryType)
  type: CategoryType;

  @ValidateIf((o) => ['CASHIER', 'BARBER'].includes(o?.role?.toUpperCase()))
  @Transform(({ value }) => {
    const num = Number(value);
    return !Number.isNaN(num) ? num : undefined;
  })
  @IsNotEmpty({ message: 'End time is required' })
  @IsInt({ message: 'End must be a whole number' })
  end: number;
}

export class Vacation {
  @IsString()
  id: string;

  @IsArray()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  dates: string[];

  @IsString()
  month: string;
}
