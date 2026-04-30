import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class FirstErrorOnlyFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionResponse = exception.getResponse();

    let messages: any[] = [];

    // Handle both object and stringified array
    try {
      const rawMessages = (exceptionResponse as any).message;
      messages =
        typeof rawMessages === 'string' ? JSON.parse(rawMessages) : rawMessages;
    } catch {
      return response.status(400).json(exceptionResponse);
    }

    const fieldErrors = messages.reduce(
      (acc: Record<string, string>, error: any) => {
        const constraints = error.constraints;
        if (constraints) {
          const firstConstraintKey = Object.keys(constraints)[0]; // isInt, isNotEmpty, etc.
          const firstMessage = constraints[firstConstraintKey];
          acc[error.property] = firstMessage;
        }
        return acc;
      },
      {},
    );

    return response.status(400).json({
      statusCode: 400,
      error: 'Bad Request',
      message: fieldErrors,
    });
  }
}
