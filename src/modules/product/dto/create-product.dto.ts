import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsString } from 'class-validator';
import { translationDto } from 'src/class-type/translation';

export class CreateProductDto {
  @IsString()
  productImg: string;

  @IsNumber()
  price: number;

  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  available: boolean;

  @IsArray()
  Translation: translationDto[];
}
