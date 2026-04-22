// src/static/static.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateAboutDto {
  @IsString() @IsNotEmpty() content: string;
  @IsString() @IsNotEmpty() location: string;
  @IsString() @IsNotEmpty() time: string;
}

export class CreateQuestionDto {
  @IsString() @IsNotEmpty() question: string;
  @IsString() @IsNotEmpty() answer: string;
}

export class CreateStaticDto {
  @IsOptional() about?: CreateAboutDto;
  @IsOptional() @IsArray() questions?: CreateQuestionDto[];
}
