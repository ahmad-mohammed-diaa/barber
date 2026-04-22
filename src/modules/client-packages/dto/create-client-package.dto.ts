import { PackagesStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateClientPackageDto {
  @IsEnum(PackagesStatus)
  type: string;
}
