import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SwaggerEnumType } from '@nestjs/swagger/dist/types/swagger-enum.type';

interface QueryParam {
  name: string;
  required?: boolean;
  type?: unknown;
  description?: string;
  enum?: SwaggerEnumType;
  example?: string;
}

interface HeaderParam {
  name: string;
  required?: boolean;
  description?: string;
  enum?: SwaggerEnumType;
}

interface PathParam {
  name: string;
  required?: boolean;
  type?: unknown;
  description?: string;
  example?: string;
}

export interface ApiDocOptions {
  summary: string;
  description?: string;
  body?: Type<unknown>;
  /** Raw OpenAPI schema for multipart/form-data bodies (use instead of `body`) */
  bodySchema?: Record<string, unknown>;
  auth?: boolean;
  consumes?: string;
  extraModels?: Type<unknown>[];
  queries?: QueryParam[];
  params?: PathParam[];
  headers?: HeaderParam[]; // For documenting expected headers (not used in actual header parsing)
}

export function ApiDoc(
  options: ApiDocOptions,
): MethodDecorator & ClassDecorator {
  const decorators: (MethodDecorator | ClassDecorator | PropertyDecorator)[] = [
    ApiOperation({
      summary: options.summary,
      description: options.description,
    }),
  ];

  if (options.auth) decorators.push(ApiBearerAuth());
  if (options.consumes) decorators.push(ApiConsumes(options.consumes));
  if (options.body) decorators.push(ApiBody({ type: options.body }));
  if (options.bodySchema)
    decorators.push(ApiBody({ schema: options.bodySchema as never }));
  if (options.extraModels?.length)
    decorators.push(ApiExtraModels(...options.extraModels));

  options.queries?.forEach((q) =>
    decorators.push(
      ApiQuery({
        name: q.name,
        required: q.required ?? false,
        type: q.type as never,
        description: q.description,
        enum: q.enum,
        example: q.example,
      }),
    ),
  );

  options.headers?.forEach((h) =>
    decorators.push(
      ApiHeader({
        name: h.name,
        required: h.required ?? false,
        description: h.description,
        enum: h.enum,
      }),
    ),
  );

  options.params?.forEach((p) =>
    decorators.push(
      ApiParam({
        name: p.name,
        required: p.required ?? true,
        example: p.example,
        type: p.type as never,
        description: p.description,
      }),
    ),
  );

  return applyDecorators(...decorators);
}
