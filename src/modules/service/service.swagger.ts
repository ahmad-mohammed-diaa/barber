import { ApiDoc } from '../../common/lib/swagger';
import { CreateServiceDto, UpdateServiceDto, ServiceStatusDto } from './dto';

export const FindAllServicesDoc = () =>
  ApiDoc({ summary: 'Get all available services' });

export const FindServiceByIdDoc = () =>
  ApiDoc({ summary: 'Get service by ID' });

export const CreateServiceDoc = () =>
  ApiDoc({
    summary: 'Create a new service',
    body: CreateServiceDto,
    extraModels: [CreateServiceDto],
    auth: true,
  });

export const UpdateServiceDoc = () =>
  ApiDoc({
    summary: 'Update a service',
    body: UpdateServiceDto,
    extraModels: [UpdateServiceDto],
    auth: true,
  });

export const SoftDeleteServiceDoc = () =>
  ApiDoc({
    summary: 'Toggle service availability',
    body: ServiceStatusDto,
    extraModels: [ServiceStatusDto],
    auth: true,
  });
