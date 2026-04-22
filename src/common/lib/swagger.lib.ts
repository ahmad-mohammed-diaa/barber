import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export const BearerAuth = () => applyDecorators(ApiBearerAuth());

export const ApiPaginationQuery = () =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({
      name: 'pageSize',
      required: false,
      type: Number,
      example: 10,
    }),
  );

export const ApiSuccessResponse = (description: string, statusCode = 200) =>
  applyDecorators(ApiResponse({ status: statusCode, description }));

export const ApiNotFoundResponse = (description = 'Resource not found') =>
  applyDecorators(ApiResponse({ status: 404, description }));

export const ApiUnauthorizedResponse = () =>
  applyDecorators(ApiResponse({ status: 401, description: 'Unauthorized' }));

export const ApiForbiddenResponse = () =>
  applyDecorators(ApiResponse({ status: 403, description: 'Forbidden' }));
