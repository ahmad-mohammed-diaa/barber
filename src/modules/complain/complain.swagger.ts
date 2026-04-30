import { ApiDoc } from '../../common/lib/swagger';
import { CreateComplainDto } from './dto/create-complain.dto';

export const CreateComplainDoc = () =>
  ApiDoc({
    summary: 'Create a new complain',
    body: CreateComplainDto,
    extraModels: [CreateComplainDto],
    auth: true,
  });

export const GetAllComplainsDoc = () =>
  ApiDoc({
    summary: 'Get all complains (Admin only)',
    auth: true,
  });

export const GetComplainByIdDoc = () =>
  ApiDoc({
    summary: 'Get a complain by ID (Admin only)',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });

export const UpdateComplainDoc = () =>
  ApiDoc({
    summary: 'Mark a complain as done (Admin only)',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });

export const DeleteComplainDoc = () =>
  ApiDoc({
    summary: 'Delete a complain by ID (Admin only)',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });
