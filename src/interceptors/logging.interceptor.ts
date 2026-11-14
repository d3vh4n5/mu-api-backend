import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { clientIp } from '../common/security/request-utils';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url } = request;
    // req.ip respeta TRUST_PROXY; x-client-ip lo manda el BFF de Astro
    const ip = clientIp(request);
    const forwarded = request.headers['x-client-ip'];
    const who = forwarded ? `${ip} (cliente ${String(forwarded)})` : ip;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `[IP: ${who}] ${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`,
          );
        },
        error: (error: unknown) => {
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          const log = status >= 500 ? 'error' : 'warn';
          this.logger[log](
            `[IP: ${who}] ${method} ${url} ${status} - ${Date.now() - now}ms`,
          );
        },
      }),
    );
  }
}
