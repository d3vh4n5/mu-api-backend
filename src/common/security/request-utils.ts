import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * IP del cliente que hizo la conexión. Si la API está detrás de un reverse
 * proxy, configurar TRUST_PROXY para que `req.ip` tome X-Forwarded-For.
 */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

export function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/** Compara la key recibida contra las válidas en tiempo constante. */
export function matchesAnyKey(
  provided: string | undefined,
  validKeys: Array<string | undefined>,
): boolean {
  if (!provided) return false;
  const received = Buffer.from(provided);
  return validKeys.some((key) => {
    if (!key) return false;
    const expected = Buffer.from(key);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  });
}

/** True si la request viene del BFF de Astro (trae SECRET_API_KEY). */
export function isBffRequest(req: Request): boolean {
  return matchesAnyKey(headerValue(req, 'x-api-key'), [
    process.env.SECRET_API_KEY,
  ]);
}
