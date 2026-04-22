import { CategoryType } from '@prisma/client';
import { ApiDoc } from '@/common/lib/swagger';
import { CreateBranchDto, UpdateBranchDto } from './dto';

export const CreateBranchDoc = () =>
  ApiDoc({
    summary: 'Create a new branch',
    body: CreateBranchDto,
    extraModels: [CreateBranchDto],
    auth: true,
  });

export const FindAllBranchesDoc = () =>
  ApiDoc({ summary: 'Get all branches' });

export const FindOneBranchDoc = () =>
  ApiDoc({
    summary: 'Get a branch by ID',
    queries: [
      { name: 'Date', required: false, type: 'string', example: '2025-06-15' },
      { name: 'type', required: false, enum: CategoryType },
    ],
  });

export const UpdateBranchDoc = () =>
  ApiDoc({
    summary: 'Update a branch',
    body: UpdateBranchDto,
    extraModels: [UpdateBranchDto],
    auth: true,
  });

export const DeleteBranchDoc = () =>
  ApiDoc({
    summary: 'Delete a branch',
    auth: true,
  });
