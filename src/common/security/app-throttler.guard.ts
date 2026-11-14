import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp, headerValue, isBffRequest } from './request-utils';

/**
 * Rate limit por IP. El BFF de Astro corre en Vercel, así que todas las
 * requests de la web llegan desde pocas IPs de Vercel: limitar por esa IP
 * frenaría a todos los usuarios juntos. Por eso:
 *  - BFF que informa `x-client-ip` → se limita por la IP real del usuario.
 *  - BFF sin `x-client-ip` → no se limita (es tráfico de confianza).
 *  - Cualquier otro cliente (launcher, desconocidos) → se limita por su IP.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (isBffRequest(request) && !headerValue(request, 'x-client-ip')) {
      return true;
    }
    return super.shouldSkip(context);
  }

  protected getTracker(request: Request): Promise<string> {
    if (isBffRequest(request)) {
      const forwarded = headerValue(request, 'x-client-ip');
      if (forwarded) return Promise.resolve(`client:${forwarded}`);
    }
    return Promise.resolve(clientIp(request));
  }
}
