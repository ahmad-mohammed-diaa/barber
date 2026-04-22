import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppSuccess } from '../../utils/AppSuccess';

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, any>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const message = this.reflector.get<string>(
      'response_message',
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => {
        // Already shaped (AppSuccess instances, auth responses with token, etc.) — pass through
        if (data && typeof data === 'object' && 'message' in data) return data;
        // Raw data — wrap with custom or default message
        return new AppSuccess(data, message ?? 'Success', 200);
      }),
    );
  }
}
