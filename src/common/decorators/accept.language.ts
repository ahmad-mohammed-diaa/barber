import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Language } from '@prisma/client';

// Custom decorator to set the Accept-Language header
export const Lang = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return Language[
      req.headers['accept-language']?.toUpperCase() ||
        req.headers['Accept-Language']?.toUpperCase() ||
        'EN'
    ];
  },
);
