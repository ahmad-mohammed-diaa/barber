import { Role } from '@prisma/client';

import { ApiDoc } from '@/common/lib/swagger';

export const FindAllUsersDoc = () =>
  ApiDoc({
    summary: 'Get all staff users (paginated, optional role filter)',
    auth: true,
    queries: [
      { name: 'page', required: false, type: 'number', example: '1' },
      { name: 'pageSize', required: false, type: 'number', example: '10' },
      { name: 'role', required: false, enum: Role },
    ],
  });

export const FindAllClientsDoc = () =>
  ApiDoc({
    summary: 'Get all client users (paginated, optional phone filter)',
    auth: true,
    queries: [
      { name: 'page', required: false, type: 'number', example: '1' },
      { name: 'pageSize', required: false, type: 'number', example: '10' },
      { name: 'phone', required: false, type: 'string' },
    ],
  });

export const UpdateUserDoc = () =>
  ApiDoc({
    summary: 'Update user profile (supports file upload for avatar)',
    auth: true,
    consumes: 'multipart/form-data',
    params: [{ name: 'id', type: 'string' }],
  });

export const UpdateBarberAvailabilityDoc = () =>
  ApiDoc({
    summary: 'Toggle barber availability on/off',
    auth: true,
    params: [{ name: 'id', type: 'string' }],
  });

export const FindOneUserDoc = () =>
  ApiDoc({
    summary: 'Get a user by ID',
    auth: true,
    params: [{ name: 'id', type: 'string' }],
  });

export const CurrentUserDoc = () =>
  ApiDoc({
    summary: 'Get the currently authenticated user profile',
    auth: true,
  });

export const DeleteAccountDoc = () =>
  ApiDoc({
    summary: 'Soft-delete the current user account',
    auth: true,
  });

export const DeleteEmployeeDoc = () =>
  ApiDoc({
    summary: 'Hard-delete a barber or cashier employee',
    auth: true,
    params: [{ name: 'id', type: 'string' }],
  });

export const RateBarberDoc = () =>
  ApiDoc({
    summary: 'Rate a barber after a completed order (1–5)',
    auth: true,
  });

export const UnbanUserDoc = () =>
  ApiDoc({
    summary: 'Unban a client user by phone number',
    auth: true,
  });
