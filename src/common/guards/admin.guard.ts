import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** ctl1_code de MEMB_INFO que se consideran administradores (igual que en el login). */
export const ADMIN_CONTROL_CODES = ['8', '32'];

type AdminRequest = {
  user?: { username?: unknown; roles?: string[] };
};

/**
 * Verifica contra la base, en cada request, que la cuenta del JWT siga siendo
 * admin. Así, quitar el rol tiene efecto inmediato aunque el token siga vigente.
 * Debe usarse después de JwtAuthGuard.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const username = request.user?.username;

    if (typeof username !== 'string' || !username) {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }

    const account = await this.prisma.mEMB_INFO.findFirst({
      where: { memb___id: username },
      select: { ctl1_code: true },
    });

    if (!account || !ADMIN_CONTROL_CODES.includes(account.ctl1_code)) {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }

    return true;
  }
}
