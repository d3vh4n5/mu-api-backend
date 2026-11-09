import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_CONTROL_CODES } from '../../common/guards/admin.guard';
import {
  classNameOf,
  effectiveAccountLevel,
  mapNameOf,
} from '../account/game-rules';
import { SetVipDto } from './dto/admin.dto';

/** Quién ejecuta la acción (sale del JWT) y desde qué IP. */
export type AdminActor = { username: string; ip?: string };

const CHARACTER_BANNED = 1;
const CHARACTER_GM = 32;
const CHARACTER_NORMAL = 0;

type AuditEntry = {
  action: string;
  targetType: 'account' | 'character';
  target: string;
  reason?: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- lectura

  async search(q: string) {
    const term = q.trim();
    const [accounts, characters] = await Promise.all([
      this.prisma.mEMB_INFO.findMany({
        where: {
          OR: [
            { memb___id: { contains: term } },
            { mail_addr: { contains: term } },
            { memb_name: { contains: term } },
          ],
        },
        select: {
          memb___id: true,
          memb_name: true,
          mail_addr: true,
          ctl1_code: true,
          AccountLevel: true,
          AccountExpireDate: true,
        },
        take: 20,
        orderBy: { memb___id: 'asc' },
      }),
      this.prisma.character.findMany({
        where: { Name: { contains: term } },
        select: {
          Name: true,
          AccountID: true,
          Class: true,
          cLevel: true,
          ResetCount: true,
          CtlCode: true,
        },
        take: 20,
        orderBy: { Name: 'asc' },
      }),
    ]);

    return {
      accounts: accounts.map((a) => ({
        username: a.memb___id,
        name: a.memb_name,
        email: a.mail_addr ?? '',
        status: this.accountStatus(a.ctl1_code),
        accountLevel: effectiveAccountLevel(
          a.AccountLevel,
          a.AccountExpireDate,
        ),
      })),
      characters: characters.map((c) => ({
        name: c.Name,
        account: c.AccountID,
        className: classNameOf(c.Class),
        level: c.cLevel ?? 1,
        resets: c.ResetCount ?? 0,
        status: this.characterStatus(c.CtlCode),
      })),
    };
  }

  async accountDetail(username: string) {
    const account = await this.findAccount(username);
    const [stat, characters, slots, audit] = await Promise.all([
      this.prisma.mEMB_STAT.findUnique({ where: { memb___id: username } }),
      this.prisma.character.findMany({
        where: { AccountID: username },
        select: {
          Name: true,
          Class: true,
          cLevel: true,
          ResetCount: true,
          CtlCode: true,
          Money: true,
          MapNumber: true,
          MapPosX: true,
          MapPosY: true,
          PkLevel: true,
          PkCount: true,
          LevelUpPoint: true,
        },
      }),
      this.prisma.accountCharacter.findUnique({ where: { Id: username } }),
      this.auditFor(username),
    ]);

    return {
      account: {
        username: account.memb___id,
        name: account.memb_name,
        email: account.mail_addr ?? '',
        status: this.accountStatus(account.ctl1_code),
        controlCode: account.ctl1_code,
        storedAccountLevel: account.AccountLevel,
        accountLevel: effectiveAccountLevel(
          account.AccountLevel,
          account.AccountExpireDate,
        ),
        vipExpiresAt: account.AccountExpireDate,
        createdAt: account.appl_days,
      },
      connection: {
        online: stat?.ConnectStat === 1,
        server: stat?.ServerName ?? null,
        ip: stat?.IP ?? null,
        lastConnect: stat?.ConnectTM ?? null,
        lastDisconnect: stat?.DisConnectTM ?? null,
        currentCharacter:
          stat?.ConnectStat === 1 ? (slots?.GameIDC ?? null) : null,
        onlineHours: stat?.OnlineHours ?? 0,
      },
      characters: characters.map((c) => ({
        name: c.Name,
        className: classNameOf(c.Class),
        level: c.cLevel ?? 1,
        resets: c.ResetCount ?? 0,
        status: this.characterStatus(c.CtlCode),
        money: c.Money ?? 0,
        freePoints: c.LevelUpPoint ?? 0,
        pk: { level: c.PkLevel ?? 3, count: c.PkCount ?? 0 },
        map: {
          name: mapNameOf(c.MapNumber),
          x: c.MapPosX ?? 0,
          y: c.MapPosY ?? 0,
        },
      })),
      audit,
    };
  }

  async online() {
    const stats = await this.prisma.mEMB_STAT.findMany({
      where: { ConnectStat: 1 },
      orderBy: { ConnectTM: 'desc' },
      take: 500,
    });
    const slots = await this.prisma.accountCharacter.findMany({
      where: { Id: { in: stats.map((s) => s.memb___id) } },
      select: { Id: true, GameIDC: true },
    });
    const current = new Map(slots.map((s) => [s.Id, s.GameIDC]));

    return stats.map((s) => ({
      username: s.memb___id,
      character: current.get(s.memb___id) ?? null,
      server: s.ServerName,
      ip: s.IP,
      since: s.ConnectTM,
    }));
  }

  audit(limit = 50, target?: string) {
    return this.prisma.adminAuditLog.findMany({
      where: target ? { Target: target } : undefined,
      orderBy: { Id: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  // ---------------------------------------------------------------- cuentas

  async banAccount(actor: AdminActor, username: string, reason: string) {
    const account = await this.findAccount(username);
    if (username === actor.username) {
      throw new BadRequestException('No podés banear tu propia cuenta');
    }
    if (ADMIN_CONTROL_CODES.includes(account.ctl1_code)) {
      throw new ForbiddenException(
        'No se puede banear una cuenta de administrador',
      );
    }
    if (account.ctl1_code === '1') {
      throw new BadRequestException('La cuenta ya está baneada');
    }

    await this.prisma.mEMB_INFO.updateMany({
      where: { memb___id: username },
      data: { ctl1_code: '1' },
    });
    await this.log(actor, {
      action: 'account.ban',
      targetType: 'account',
      target: username,
      reason,
      details: { previousCode: account.ctl1_code },
    });

    const online = await this.isOnline(username);
    return {
      message: online
        ? `Cuenta ${username} baneada. Está conectada: el ban se aplica al próximo ingreso.`
        : `Cuenta ${username} baneada`,
    };
  }

  async unbanAccount(actor: AdminActor, username: string, reason?: string) {
    const account = await this.findAccount(username);
    if (account.ctl1_code !== '1') {
      throw new BadRequestException('La cuenta no está baneada');
    }

    await this.prisma.mEMB_INFO.updateMany({
      where: { memb___id: username },
      data: { ctl1_code: '0' },
    });
    await this.log(actor, {
      action: 'account.unban',
      targetType: 'account',
      target: username,
      reason,
    });
    return { message: `Cuenta ${username} desbaneada` };
  }

  async setVip(actor: AdminActor, username: string, dto: SetVipDto) {
    const account = await this.findAccount(username);
    if (dto.level > 0 && !dto.days) {
      throw new BadRequestException('Indicá la duración en días');
    }

    const expiresAt =
      dto.level > 0
        ? new Date(Date.now() + (dto.days as number) * 24 * 60 * 60 * 1000)
        : new Date();

    await this.prisma.mEMB_INFO.updateMany({
      where: { memb___id: username },
      data: { AccountLevel: dto.level, AccountExpireDate: expiresAt },
    });
    await this.log(actor, {
      action: 'account.vip',
      targetType: 'account',
      target: username,
      reason: dto.reason,
      details: {
        from: {
          level: account.AccountLevel,
          expiresAt: account.AccountExpireDate,
        },
        to: { level: dto.level, expiresAt, days: dto.days ?? null },
      },
    });

    return {
      message:
        dto.level > 0
          ? `VIP ${dto.level} asignado a ${username} hasta el ${expiresAt.toLocaleDateString('es-AR')}`
          : `Se quitó el VIP a ${username}`,
    };
  }

  // ----------------------------------------------------------- personajes

  async banCharacter(actor: AdminActor, name: string, reason: string) {
    const character = await this.findCharacter(name);
    if (character.CtlCode === CHARACTER_BANNED) {
      throw new BadRequestException('El personaje ya está baneado');
    }
    await this.setCharacterCode(
      actor,
      character,
      CHARACTER_BANNED,
      'character.ban',
      reason,
    );
    return { message: `Personaje ${character.Name} baneado` };
  }

  async unbanCharacter(actor: AdminActor, name: string, reason?: string) {
    const character = await this.findCharacter(name);
    if (character.CtlCode !== CHARACTER_BANNED) {
      throw new BadRequestException('El personaje no está baneado');
    }
    await this.setCharacterCode(
      actor,
      character,
      CHARACTER_NORMAL,
      'character.unban',
      reason,
    );
    return { message: `Personaje ${character.Name} desbaneado` };
  }

  async grantGm(actor: AdminActor, name: string, reason?: string) {
    const character = await this.findCharacter(name);
    if (character.CtlCode === CHARACTER_BANNED) {
      throw new BadRequestException(
        'No se puede dar GM a un personaje baneado',
      );
    }
    if (character.CtlCode === CHARACTER_GM) {
      throw new BadRequestException('El personaje ya es GM');
    }
    await this.setCharacterCode(
      actor,
      character,
      CHARACTER_GM,
      'character.gm.grant',
      reason,
    );
    return { message: `${character.Name} ahora es GM` };
  }

  async revokeGm(actor: AdminActor, name: string, reason?: string) {
    const character = await this.findCharacter(name);
    if (character.CtlCode !== CHARACTER_GM) {
      throw new BadRequestException('El personaje no es GM');
    }
    await this.setCharacterCode(
      actor,
      character,
      CHARACTER_NORMAL,
      'character.gm.revoke',
      reason,
    );
    return { message: `${character.Name} ya no es GM` };
  }

  // ---------------------------------------------------------------- helpers

  private async setCharacterCode(
    actor: AdminActor,
    character: { Name: string; AccountID: string; CtlCode: number | null },
    code: number,
    action: string,
    reason?: string,
  ) {
    await this.prisma.character.update({
      where: { Name: character.Name },
      data: { CtlCode: code },
    });
    await this.log(actor, {
      action,
      targetType: 'character',
      target: character.Name,
      reason,
      details: {
        account: character.AccountID,
        previousCode: character.CtlCode,
        newCode: code,
      },
    });
  }

  private async findAccount(username: string) {
    const account = await this.prisma.mEMB_INFO.findFirst({
      where: { memb___id: username },
    });
    if (!account)
      throw new NotFoundException(`La cuenta "${username}" no existe`);
    return account;
  }

  private async findCharacter(name: string) {
    const character = await this.prisma.character.findUnique({
      where: { Name: name },
      select: { Name: true, AccountID: true, CtlCode: true },
    });
    if (!character)
      throw new NotFoundException(`El personaje "${name}" no existe`);
    return character;
  }

  private async isOnline(username: string) {
    const stat = await this.prisma.mEMB_STAT.findUnique({
      where: { memb___id: username },
      select: { ConnectStat: true },
    });
    return stat?.ConnectStat === 1;
  }

  /** Últimas acciones sobre una cuenta y sus personajes. */
  private async auditFor(username: string) {
    const characters = await this.prisma.character.findMany({
      where: { AccountID: username },
      select: { Name: true },
    });
    return this.prisma.adminAuditLog.findMany({
      where: { Target: { in: [username, ...characters.map((c) => c.Name)] } },
      orderBy: { Id: 'desc' },
      take: 30,
    });
  }

  private log(actor: AdminActor, entry: AuditEntry) {
    return this.prisma.adminAuditLog.create({
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

  private accountStatus(code: string) {
    if (code === '1') return 'banned';
    if (ADMIN_CONTROL_CODES.includes(code)) return 'admin';
    return 'active';
  }

  private characterStatus(code: number | null) {
    if (code === CHARACTER_BANNED) return 'banned';
    if (code === CHARACTER_GM || code === 8) return 'gm';
    return 'normal';
  }
}
