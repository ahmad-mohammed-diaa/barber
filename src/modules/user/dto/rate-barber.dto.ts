import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class RateBarberDto {
  @ApiProperty({ example: 'barber-uuid' })
  @IsNotEmpty()
  @IsString()
  barberId: string;

  @ApiProperty({ example: 'order-uuid' })
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 4 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
