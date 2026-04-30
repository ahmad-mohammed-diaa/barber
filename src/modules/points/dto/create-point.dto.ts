import { IsArray, IsNotEmpty, IsNumber } from 'class-validator';
import { translationDto } from '../../../common/class-type/translation';
import { Transform } from 'class-transformer';

export class CreatePointDto {
  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => +value)
  price: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => +value)
  points: number;

  @IsArray()
  Translation: translationDto[];
}
