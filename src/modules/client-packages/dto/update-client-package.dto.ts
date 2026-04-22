import { PartialType } from '@nestjs/mapped-types';
import { CreateClientPackageDto } from './create-client-package.dto';

export class UpdateClientPackageDto extends PartialType(CreateClientPackageDto) {}
