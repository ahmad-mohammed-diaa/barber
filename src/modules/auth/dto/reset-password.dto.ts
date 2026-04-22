import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '01234567890' })
  @IsNotEmpty()
  @IsString()
  phone: string;
}
