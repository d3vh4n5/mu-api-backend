import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  user: Record<string, unknown>;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token Bearer requerido');
    }

    try {
      request.user =
        await this.jwtService.verifyAsync<Record<string, unknown>>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
