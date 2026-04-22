import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StaticService } from './static.service';
import { CreateAboutDto, CreateQuestionDto } from './dto/create-static.dto';
import { UpdateStaticDto } from './dto/update-static.dto';
import {
  CreateAboutDoc,
  CreateQuestionsDoc,
  GetStaticDoc,
  UpdateAboutDoc,
  UpdateQuestionDoc,
  DeleteQuestionDoc,
} from './static.swagger';

@ApiTags('Static')
@Controller('static')
export class StaticController {
  constructor(private readonly staticService: StaticService) {}

  @Post('/about')
  @CreateAboutDoc()
  createAbout(@Body() data: CreateAboutDto) {
    return this.staticService.createAbout(data);
  }

  @Post('/questions')
  @CreateQuestionsDoc()
  createQuestions(@Body() data: CreateQuestionDto) {
    return this.staticService.createQuestions(data);
  }

  @Get()
  @GetStaticDoc()
  getStatic() {
    return this.staticService.getStatic();
  }

  @Put('/about')
  @UpdateAboutDoc()
  updateAbout(@Body() data: UpdateStaticDto) {
    return this.staticService.updateAbout(data);
  }

  @Put('question/:id')
  @UpdateQuestionDoc()
  updateQuestion(@Param('id') id: string, @Body() data: CreateQuestionDto) {
    return this.staticService.updateQuestion(id, data);
  }

  @Delete('question/:id')
  @DeleteQuestionDoc()
  deleteQuestion(@Param('id') id: string) {
    return this.staticService.deleteQuestion(id);
  }
}
