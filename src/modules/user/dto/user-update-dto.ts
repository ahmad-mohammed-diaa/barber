import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { RegisterDto } from '../../../modules/auth/dto/auth-register-dto';

export class UserUpdateDto extends PartialType(RegisterDto) {
  @ApiPropertyOptional({ type: [String], example: ['vacation-id-1'] })
  @IsOptional()
  @IsString({ each: true })
  vacationsToDelete?: string[];
}
