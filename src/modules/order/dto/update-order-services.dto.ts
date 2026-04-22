import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateOrderServicesDto {
  @ApiProperty({ type: [String], example: ['uuid-service-id'] })
  @IsArray()
  @IsString({ each: true })
  serviceToDelete: string[];
}
