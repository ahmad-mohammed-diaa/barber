import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ServiceStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  available: boolean;
}
