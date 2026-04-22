import { Injectable } from '@nestjs/common';
import { CreateAboutDto, CreateQuestionDto } from './dto/create-static.dto';
import { UpdateStaticDto } from './dto/update-static.dto';
import { StaticQueryService } from './services/static-query.service';
import { StaticMutationService } from './services/static-mutation.service';

@Injectable()
export class StaticService {
  constructor(
    private readonly staticQuery: StaticQueryService,
    private readonly staticMutation: StaticMutationService,
  ) {}

  getStatic() {
    return this.staticQuery.getStatic();
  }

  createAbout(data: CreateAboutDto) {
    return this.staticMutation.createAbout(data);
  }

  createQuestions(data: CreateQuestionDto) {
    return this.staticMutation.createQuestions(data);
  }

  updateAbout(data: UpdateStaticDto) {
    return this.staticMutation.updateAbout(data);
  }

  updateQuestion(id: string, data: CreateQuestionDto) {
    return this.staticMutation.updateQuestion(id, data);
  }

  deleteQuestion(id: string) {
    return this.staticMutation.deleteQuestion(id);
  }

  ensureStaticExists(id: string) {
    return this.staticQuery.ensureStaticExists(id);
  }
}
