import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
} from '@nestjs/common';

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const branch = process.env.VERCEL_GIT_COMMIT_REF || 'unknown';

    response.status(404).json({
      message: `Cannot GET /`,
      branch,
      error: 'Not Found',
      statusCode: 404,
    });
  }
}
