import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';

type RolesRequest = Request & {
  user?: { roles?: string[] };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<RolesRequest>();
    const userRoles = request.user?.roles ?? [];
    if (requiredRoles.some((role) => userRoles.includes(role))) return true;

    throw new ForbiddenException('No tienes permisos para esta acción');
  }
}
