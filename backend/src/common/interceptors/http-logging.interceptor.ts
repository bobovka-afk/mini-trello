import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

type RequestWithContext = Request & {
  id?: string;
  user?: { id?: string };
};

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly skippedPaths = new Set(['/health', '/ready']);

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpLoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithContext>();
    const res = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => this.logRequest(req, res, startedAt)),
    );
  }

  private logRequest(
    req: RequestWithContext,
    res: Response,
    startedAt: number,
  ): void {
    const path = req.originalUrl ?? req.url;

    if (this.shouldSkip(path)) {
      return;
    }

    const requestId =
      req.id ??
      (Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id']);

    this.logger.info(
      {
        requestId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        userId: req.user?.id,
      },
      'http_request',
    );
  }

  private shouldSkip(path: string): boolean {
    const normalizedPath = path.split('?')[0];
    return this.skippedPaths.has(normalizedPath);
  }
}
