import { CategoryType } from '@prisma/client';

import { ApiDoc } from '@/common/lib/swagger';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

export const FindAllCategoriesDoc = () =>
  ApiDoc({
    queries: [{ name: 'type', required: false, enum: CategoryType }],
    summary: 'Get all categories with services',
    auth: true,
  });

export const FindCategoryByIdDoc = () =>
  ApiDoc({
    params: [{ name: 'id', type: 'string' }],
    summary: 'Get a category by ID',
    auth: true,
  });

export const CreateCategoryDoc = () =>
  ApiDoc({
    extraModels: [CreateCategoryDto],
    summary: 'Create a new category',
    body: CreateCategoryDto,
    auth: true,
  });

export const UpdateCategoryDoc = () =>
  ApiDoc({
    extraModels: [UpdateCategoryDto],
    summary: 'Update a category',
    body: UpdateCategoryDto,
    auth: true,
  });

export const DeleteCategoryDoc = () =>
  ApiDoc({
    params: [{ name: 'id', type: 'string' }],
    summary: 'Delete a category',
    auth: true,
  });
