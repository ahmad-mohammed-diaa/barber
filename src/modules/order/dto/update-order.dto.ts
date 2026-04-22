import { CreateOrderDto } from './create-order.dto';
import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiPropertyOptional({ type: [String], example: ['uuid-service-id'] })
  @IsOptional()
  @IsArray()
  add: string[];

  @ApiPropertyOptional({ type: [String], example: ['uuid-service-id'] })
  @IsOptional()
  @IsArray()
  remove: string[];

  @ApiPropertyOptional({ type: [String], example: ['uuid-package-id'] })
  @IsOptional()
  @IsArray()
  addPackage: string[];

  @ApiPropertyOptional({ type: [String], example: ['uuid-package-id'] })
  @IsOptional()
  @IsArray()
  removePackage: string[];
}
