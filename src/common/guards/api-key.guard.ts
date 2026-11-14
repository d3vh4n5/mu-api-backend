// common/guards/api-key.guard.ts

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IpBlocklistService } from '../security/ip-blocklist.service';
import {
  clientIp,
  headerValue,
  matchesAnyKey,
} from '../security/request-utils';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly blocklist: IpBlocklistService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(request);

    const valid = matchesAnyKey(headerValue(request, 'x-api-key'), [
      this.configService.get<string>('SECRET_API_KEY'),
    ]);

    if (!valid) {
      this.blocklist.registerFailure(ip);
      throw new UnauthorizedException('API key inválida');
    }

    this.blocklist.registerSuccess(ip);
    return true;
  }
}
