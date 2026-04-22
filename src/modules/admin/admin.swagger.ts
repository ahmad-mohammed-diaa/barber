import { ApiDoc } from '@/common/lib/swagger';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

export const CreateAdminDoc = () =>
  ApiDoc({
    summary: 'Create initial admin settings (ADMIN only)',
    body: CreateAdminDto,
    extraModels: [CreateAdminDto],
    auth: true,
  });

export const FindAllAdminDoc = () =>
  ApiDoc({
    summary: 'Get current settings (ADMIN only)',
    auth: true,
  });

export const GetAnalyticsDoc = () =>
  ApiDoc({
    summary: 'Get analytics summary for ADMIN or CASHIER',
    queries: [
      { name: 'fromDate', required: false, type: 'string' },
      { name: 'toDate', required: false, type: 'string' },
    ],
    auth: true,
  });

export const UpdateAdminDoc = () =>
  ApiDoc({
    summary: 'Update settings (ADMIN only)',
    body: UpdateAdminDto,
    extraModels: [UpdateAdminDto],
    auth: true,
  });

export const CheckPasswordDoc = () =>
  ApiDoc({
    summary: 'Verify admin password (ADMIN or CASHIER)',
    auth: true,
  });
