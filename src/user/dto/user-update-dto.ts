import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { RegisterDto } from 'src/auth/dto/auth-register-dto';

export class UserUpdateDto extends PartialType(RegisterDto) {
  @IsOptional()
  @IsString({ each: true })
  vacationsToDelete?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'boolean' ? value : value === 'true',
  )
  @IsBoolean()
  isAvailable?: boolean;
}
