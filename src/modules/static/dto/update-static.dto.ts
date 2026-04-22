import { PartialType } from '@nestjs/mapped-types';
import { CreateStaticDto } from './create-static.dto';
import { IsArray, IsOptional } from 'class-validator';

export class UpdateStaticDto extends PartialType(CreateStaticDto) {
  @IsOptional() @IsArray() remove?: string[];
}
