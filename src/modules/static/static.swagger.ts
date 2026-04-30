import { ApiDoc } from '../../common/lib/swagger';
import { CreateAboutDto, CreateQuestionDto } from './dto/create-static.dto';
import { UpdateStaticDto } from './dto/update-static.dto';

export const CreateAboutDoc = () =>
  ApiDoc({
    summary: 'Create or update the about section',
    body: CreateAboutDto,
    extraModels: [CreateAboutDto],
  });

export const CreateQuestionsDoc = () =>
  ApiDoc({
    summary: 'Add FAQ questions to the static data',
    body: CreateQuestionDto,
    extraModels: [CreateQuestionDto],
  });

export const GetStaticDoc = () =>
  ApiDoc({
    summary: 'Get all static data (about + questions)',
  });

export const UpdateAboutDoc = () =>
  ApiDoc({
    summary: 'Update the about section',
    body: UpdateStaticDto,
    extraModels: [UpdateStaticDto],
  });

export const UpdateQuestionDoc = () =>
  ApiDoc({
    summary: 'Update a question by ID',
    params: [{ name: 'id', type: 'string' }],
    body: CreateQuestionDto,
    extraModels: [CreateQuestionDto],
  });

export const DeleteQuestionDoc = () =>
  ApiDoc({
    summary: 'Delete a question by ID',
    params: [{ name: 'id', type: 'string' }],
  });
