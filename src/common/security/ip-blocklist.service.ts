import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { clientIp } from './request-utils';

type Entry = { failures: number; blockedUntil: number; lastFailure: number };

/**
 * Bloqueo temporal de IPs que fallan la API key repetidas veces
 * (port del middleware `guardian` de la API vieja). En memoria: se reinicia
 * con el servicio, igual que antes.
 */
@Injectable()
export class IpBlocklistService implements OnModuleDestroy {
  private readonly logger = new Logger('IpBlocklist');
  private readonly entries = new Map<string, Entry>();
  private readonly maxFailures = Number(process.env.BLOCK_MAX_FAILURES ?? 5);
  private readonly blockMs =
    Number(process.env.BLOCK_MINUTES ?? 15) * 60 * 1000;
  private readonly cleanup = setInterval(() => this.purge(), 60 * 60 * 1000);

  constructor() {
    this.cleanup.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanup);
  }

  isBlocked(ip: string): boolean {
    const entry = this.entries.get(ip);
    if (!entry || entry.blockedUntil === 0) return false;
    if (Date.now() < entry.blockedUntil) return true;
    this.entries.delete(ip); // expiró el bloqueo: otra oportunidad
    return false;
  }

  registerFailure(ip: string) {
    const now = Date.now();
    const entry = this.entries.get(ip) ?? {
      failures: 0,
      blockedUntil: 0,
      lastFailure: now,
    };
    entry.failures += 1;
    entry.lastFailure = now;

    if (entry.failures >= this.maxFailures && entry.blockedUntil === 0) {
      entry.blockedUntil = now + this.blockMs;
      this.logger.warn(
        `🚫 IP bloqueada: ${ip} hasta ${new Date(entry.blockedUntil).toISOString()}`,
      );
    }

    this.entries.set(ip, entry);
  }

  registerSuccess(ip: string) {
    const entry = this.entries.get(ip);
    if (entry && entry.blockedUntil === 0) this.entries.delete(ip);
  }

  /** Middleware de Express que corta las requests de IPs bloqueadas. */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.isBlocked(clientIp(req))) {
        res.status(403).json({
          statusCode: 403,
          message:
            'Tu IP ha sido bloqueada temporalmente por actividad sospechosa.',
        });
        return;
      }
      next();
    };
  }

  private purge() {
    const now = Date.now();
    for (const [ip, entry] of this.entries) {
      const expiredBlock =
        entry.blockedUntil !== 0 && now >= entry.blockedUntil;
      const staleFailures =
        entry.blockedUntil === 0 && now - entry.lastFailure > this.blockMs;
      if (expiredBlock || staleFailures) this.entries.delete(ip);
    }
  }
}
