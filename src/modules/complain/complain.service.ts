import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { CreateComplainDto } from './dto/create-complain.dto';
import { ComplainQueryService } from './services/complain-query.service';
import { ComplainMutationService } from './services/complain-mutation.service';

@Injectable()
export class ComplainService {
  constructor(
    private readonly complainQuery: ComplainQueryService,
    private readonly complainMutation: ComplainMutationService,
  ) {}

  getAllComplains() {
    return this.complainQuery.getAllComplains();
  }

  findOne(id: string) {
    return this.complainQuery.findOne(id);
  }

  createComplain(dto: CreateComplainDto, user: User) {
    return this.complainMutation.createComplain(dto, user);
  }

  updateComplain(id: string) {
    return this.complainMutation.updateComplain(id);
  }

  remove(id: string) {
    return this.complainMutation.remove(id);
  }
}
