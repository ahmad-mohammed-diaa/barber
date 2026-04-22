import { CreateServiceDto } from './create-service.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
