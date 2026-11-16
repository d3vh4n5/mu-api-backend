import type { PrismaService } from '../../prisma/prisma.service';

/** Quién ejecuta la acción (sale del JWT) y desde qué IP. */
export type AdminActor = { username: string; ip?: string };

export type AuditEntry = {
  action: string;
  targetType: 'account' | 'character' | 'news';
  target: string;
  reason?: string;
  details?: Record<string, unknown>;
};

/** Registra una acción de administrador en AdminAuditLog. */
export function writeAdminAudit(
  prisma: PrismaService,
  actor: AdminActor,
  entry: AuditEntry,
) {
  return prisma.adminAuditLog.create({
    data: {
      AdminUser: actor.username.slice(0, 10),
      Action: entry.action,
      TargetType: entry.targetType,
      Target: entry.target.slice(0, 50),
      Reason: entry.reason?.trim().slice(0, 255) || null,
      Details: entry.details ? JSON.stringify(entry.details) : null,
      Ip: actor.ip?.slice(0, 45) ?? null,
    },
  });
}
