import { ApiDoc } from '../../common/lib/swagger';
import { Language } from '@prisma/client';

export const CreateClientPackageDoc = () =>
  ApiDoc({
    summary: 'Create a client package',
    queries: [{ name: 'packageId', required: true, type: 'string' }],
    auth: true,
  });

export const FindAllClientPackagesDoc = () =>
  ApiDoc({
    summary: 'Get all client packages',
    queries: [{ name: 'language', required: false, enum: Language }],
    auth: true,
  });

export const FindOneClientPackageDoc = () =>
  ApiDoc({
    summary: 'Get a client package by ID',
    params: [{ name: 'id', type: 'string' }],
    queries: [{ name: 'language', required: false, enum: Language }],
    auth: true,
  });

export const UpdateClientPackageDoc = () =>
  ApiDoc({
    summary: 'Update a client package by ID',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });

export const RemoveClientPackageDoc = () =>
  ApiDoc({
    summary: 'Delete a client package by ID',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });
