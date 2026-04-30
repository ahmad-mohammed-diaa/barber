import { ApiDoc } from '../../common/lib/swagger';
import { UpdatePointDto } from './dto/update-point.dto';

export const CreatePointDoc = () =>
  ApiDoc({
    summary: 'Create a new points offer',
    consumes: 'multipart/form-data',
    auth: true,
  });

export const FindAllPointsDoc = () =>
  ApiDoc({
    summary: 'Get all points offers',
    queries: [{ name: 'language', required: false, type: 'string' }],
    auth: true,
  });

export const PurchasePointDoc = () =>
  ApiDoc({
    summary: 'Purchase a point offer',
    params: [{ name: 'pointId', type: 'string' }],
    auth: true,
  });

export const FindOnePointDoc = () =>
  ApiDoc({
    summary: 'Get a point offer by ID',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });

export const UpdatePointDoc = () =>
  ApiDoc({
    summary: 'Update a point offer',
    params: [{ name: 'id', type: 'string' }],
    body: UpdatePointDto,
    extraModels: [UpdatePointDto],
    auth: true,
  });

export const RemovePointDoc = () =>
  ApiDoc({
    summary: 'Delete a point offer',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });
