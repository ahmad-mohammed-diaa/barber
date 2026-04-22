import { PartialType } from '@nestjs/mapped-types';
import { CreateComplainDto } from './create-complain.dto';

export class UpdateComplainDto extends PartialType(CreateComplainDto) {}
