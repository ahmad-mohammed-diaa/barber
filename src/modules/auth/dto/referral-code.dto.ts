import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReferralCodeDto {
  @ApiProperty({ example: 'ABC123' })
  @IsNotEmpty()
  @IsString()
  referralCode: string;
}
