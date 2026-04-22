import { IsNotEmpty, IsString } from 'class-validator';

export class CreateComplainDto {
  // @IsNotEmpty()
  // userId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
