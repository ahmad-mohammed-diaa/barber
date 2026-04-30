import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserData = createParamDecorator(
  (data: 'user' | 'token', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data === 'token' ? request.token : request.user;
  },
);
