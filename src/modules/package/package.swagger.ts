import { ApiDoc } from '@/common/lib/swagger';
import { CreatePackageDto } from './dto/create-package.dto';
import { Language } from '@prisma/client';

export const CreatePackageDoc = () =>
  ApiDoc({
    summary: 'Create a new package',
    body: CreatePackageDto,
    extraModels: [CreatePackageDto],
    auth: true,
  });

export const FindAllPackagesDoc = () =>
  ApiDoc({
    summary: 'Get all packages',
    queries: [{ name: 'language', required: false, enum: Language }],
    auth: true,
  });

export const FindOnePackageDoc = () =>
  ApiDoc({
    summary: 'Get a package by ID',
    params: [{ name: 'id', type: 'string' }],
    queries: [{ name: 'language', required: false, enum: Language }],
    auth: true,
  });

export const UpdatePackageDoc = () =>
  ApiDoc({
    summary: 'Update a package by ID',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });

export const RemovePackageDoc = () =>
  ApiDoc({
    summary: 'Delete all packages',
    auth: true,
  });
