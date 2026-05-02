import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

type RequestWithContext = Request & {
  id?: string;
  user?: { id?: string };
};

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithContext>();
    const res = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message = this.resolveMessage(statusCode, exceptionResponse);
    const errorCode =
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      typeof (exceptionResponse as { code?: unknown }).code === 'string'
        ? (exceptionResponse as { code: string }).code
        : undefined;
    const requestId =
      req.id ??
      (Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id']);

    // Keep error context useful while avoiding sensitive request payload logging.
    this.logger.error(
      {
        requestId,
        method: req.method,
        path: req.originalUrl ?? req.url,
        statusCode,
        userId: req.user?.id,
        err:
          exception instanceof Error
            ? {
                name: exception.name,
                message: exception.message,
                stack: exception.stack,
              }
            : { message: String(exception) },
      },
      'Request failed',
    );

    res.status(statusCode).json({
      statusCode,
      message,
      ...(errorCode ? { code: errorCode } : {}),
      path: req.originalUrl ?? req.url,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  private resolveMessage(statusCode: number, exceptionResponse: unknown): unknown {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const obj = exceptionResponse as { message?: unknown };
      if (
        statusCode === HttpStatus.SERVICE_UNAVAILABLE ||
        statusCode === HttpStatus.BAD_GATEWAY
      ) {
        const maybeMessage = obj.message;
        if (typeof maybeMessage === 'string') return maybeMessage;
        if (Array.isArray(maybeMessage)) return maybeMessage.join(', ');
      }
    }

    if (statusCode >= 500) {
      return 'Internal server error';
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const maybeMessage = (exceptionResponse as { message?: unknown }).message;
      return maybeMessage ?? 'Request failed';
    }

    return 'Request failed';
  }
}