import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url } = request;

    // Obtenemos la IP: primero intentamos de headers (por si usas Proxy) 
    // y si no, la del objeto request directo.
    const ip =
      request.headers['x-forwarded-for'] ||
      request.socket.remoteAddress ||
      '0.0.0.0';

    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = response;
        const delay = Date.now() - now;

        // Logeamos incluyendo la IP del cliente de Mu
        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `[IP: ${ip}] ${method} ${url} ${statusCode} - ${delay}ms`,
        );
      }),
    );
  }
}
