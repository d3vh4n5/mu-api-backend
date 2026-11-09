import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddPointsDto } from './dto/add-points.dto';
import {
  AccountLevel,
  CLASS_CODES,
  DEFAULT_STATS,
  LORENCIA_SPAWN,
  LevelRules,
  PK_NORMAL_LEVEL,
  RESET_START_LEVEL,
  baseClassOf,
  classNameOf,
  computeResetPoints,
  effectiveAccountLevel,
  mapNameOf,
  rulesFor,
} from './game-rules';

const CHARACTER_SELECT = {
  AccountID: true,
  Name: true,
  Class: true,
  cLevel: true,
  LevelUpPoint: true,
  Strength: true,
  Dexterity: true,
  Vitality: true,
  Energy: true,
  Leadership: true,
  Money: true,
  MapNumber: true,
  MapPosX: true,
  MapPosY: true,
  PkLevel: true,
  PkCount: true,
  CtlCode: true,
  ResetCount: true,
  FruitAddPoint: true,
} as const;

type CharacterRow = {
  AccountID: string;
  Name: string;
  Class: number | null;
  cLevel: number | null;
  LevelUpPoint: number | null;
  Strength: number | null;
  Dexterity: number | null;
  Vitality: number | null;
  Energy: number | null;
  Leadership: number | null;
  Money: number | null;
  MapNumber: number | null;
  MapPosX: number | null;
  MapPosY: number | null;
  PkLevel: number | null;
  PkCount: number | null;
  CtlCode: number | null;
  ResetCount: number;
  FruitAddPoint: number;
};

const STAT_KEYS = [
  ['strength', 'Strength'],
  ['dexterity', 'Dexterity'],
  ['vitality', 'Vitality'],
  ['energy', 'Energy'],
  ['leadership', 'Leadership'],
] as const;

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(username: string) {
    const account = await this.findAccount(username);
    const level = effectiveAccountLevel(
      account.AccountLevel,
      account.AccountExpireDate,
    );
    const rules = rulesFor(level);
    const online = await this.isOnline(username);

    const [characters, slots] = await Promise.all([
      this.prisma.character.findMany({
        where: { AccountID: username },
        select: CHARACTER_SELECT,
      }),
      this.prisma.accountCharacter.findUnique({ where: { Id: username } }),
    ]);

    const order = [
      slots?.GameID1,
      slots?.GameID2,
      slots?.GameID3,
      slots?.GameID4,
      slots?.GameID5,
    ];
    const position = (name: string) => {
      const index = order.indexOf(name);
      return index === -1 ? order.length : index;
    };
    characters.sort((a, b) => position(a.Name) - position(b.Name));

    return {
      account: {
        username: account.memb___id,
        name: account.memb_name,
        email: account.mail_addr ?? '',
        accountLevel: level,
        vipExpiresAt: level > 0 ? account.AccountExpireDate : null,
        online,
      },
      rules,
      characters: characters.map((c) => this.toView(c, rules)),
    };
  }

  async reset(username: string, name: string) {
    const { character, rules } = await this.prepareAction(username, name);
    const resets = character.ResetCount ?? 0;
    const level = character.cLevel ?? 1;
    const money = character.Money ?? 0;

    if (resets >= rules.resetLimit) {
      throw new BadRequestException(
        `Alcanzaste el máximo de ${rules.resetLimit} resets`,
      );
    }
    if (level < rules.resetLevel) {
      throw new BadRequestException(
        `Necesitás nivel ${rules.resetLevel} para resetear (tenés ${level})`,
      );
    }
    if (money < rules.resetMoney) {
      throw new BadRequestException(
        `Necesitás ${rules.resetMoney.toLocaleString('es-AR')} de zen en el personaje`,
      );
    }

    const baseClass = baseClassOf(character.Class);
    const stats = DEFAULT_STATS[baseClass];
    const newResets = resets + rules.resetCount;
    const points = computeResetPoints({
      resets: newResets,
      resetPoint: rules.resetPoint,
      baseClass,
      fruitAddPoint: character.FruitAddPoint,
    });

    // Condiciones en el WHERE para evitar dobles resets por requests simultáneos
    const result = await this.prisma.character.updateMany({
      where: {
        Name: character.Name,
        AccountID: username,
        ResetCount: resets,
        cLevel: { gte: rules.resetLevel },
        Money: { gte: rules.resetMoney },
      },
      data: {
        cLevel: RESET_START_LEVEL,
        Experience: 0,
        Money: { decrement: rules.resetMoney },
        ResetCount: newResets,
        LevelUpPoint: points,
        Strength: stats.strength,
        Dexterity: stats.dexterity,
        Vitality: stats.vitality,
        Energy: stats.energy,
        Leadership: stats.leadership,
        MapNumber: LORENCIA_SPAWN.map,
        MapPosX: LORENCIA_SPAWN.x,
        MapPosY: LORENCIA_SPAWN.y,
      },
    });
    this.assertUpdated(result.count);

    return {
      message: `${character.Name} hizo su reset número ${newResets}. Tenés ${points} puntos para repartir.`,
      character: await this.reload(username, character.Name, rules),
    };
  }

  async addPoints(username: string, name: string, dto: AddPointsDto) {
    const { character, rules } = await this.prepareAction(username, name);
    const isDarkLord = baseClassOf(character.Class) === CLASS_CODES.DL;

    if ((dto.leadership ?? 0) > 0 && !isDarkLord) {
      throw new BadRequestException('Solo el Dark Lord puede sumar Comando');
    }

    const total = STAT_KEYS.reduce((sum, [key]) => sum + (dto[key] ?? 0), 0);
    if (total <= 0) {
      throw new BadRequestException('Indicá cuántos puntos querés agregar');
    }

    const available = character.LevelUpPoint ?? 0;
    if (total > available) {
      throw new BadRequestException(
        `Solo tenés ${available} puntos disponibles`,
      );
    }

    const increments: Record<string, { increment: number }> = {};
    for (const [key, column] of STAT_KEYS) {
      const amount = dto[key] ?? 0;
      if (amount <= 0) continue;
      const current = character[column] ?? 0;
      if (current + amount > rules.maxStatPoint) {
        throw new BadRequestException(
          `${this.statLabel(key)} no puede superar ${rules.maxStatPoint} (máximo a agregar: ${Math.max(0, rules.maxStatPoint - current)})`,
        );
      }
      increments[column] = { increment: amount };
    }

    const result = await this.prisma.character.updateMany({
      where: {
        Name: character.Name,
        AccountID: username,
        LevelUpPoint: { gte: total },
      },
      data: {
        ...increments,
        LevelUpPoint: { decrement: total },
      },
    });
    this.assertUpdated(result.count);

    return {
      message: `Se agregaron ${total} puntos a ${character.Name}`,
      character: await this.reload(username, character.Name, rules),
    };
  }

  async clearPk(username: string, name: string) {
    const { character, rules } = await this.prepareAction(username, name);

    if ((character.PkLevel ?? PK_NORMAL_LEVEL) <= PK_NORMAL_LEVEL) {
      throw new BadRequestException(`${character.Name} no tiene estado PK`);
    }
    if ((character.Money ?? 0) < rules.pkClearMoney) {
      throw new BadRequestException(
        `Necesitás ${rules.pkClearMoney.toLocaleString('es-AR')} de zen en el personaje`,
      );
    }

    const result = await this.prisma.character.updateMany({
      where: {
        Name: character.Name,
        AccountID: username,
        PkLevel: { gt: PK_NORMAL_LEVEL },
        Money: { gte: rules.pkClearMoney },
      },
      data: {
        PkLevel: PK_NORMAL_LEVEL,
        PkCount: 0,
        PkTime: 0,
        Money: { decrement: rules.pkClearMoney },
      },
    });
    this.assertUpdated(result.count);

    return {
      message: `Se limpió el estado PK de ${character.Name}`,
      character: await this.reload(username, character.Name, rules),
    };
  }

  async unstuck(username: string, name: string) {
    const { character, rules } = await this.prepareAction(username, name);

    await this.prisma.character.updateMany({
      where: { Name: character.Name, AccountID: username },
      data: {
        MapNumber: LORENCIA_SPAWN.map,
        MapPosX: LORENCIA_SPAWN.x,
        MapPosY: LORENCIA_SPAWN.y,
      },
    });

    return {
      message: `${character.Name} fue movido a Lorencia`,
      character: await this.reload(username, character.Name, rules),
    };
  }

  private async findAccount(username: string) {
    const account = await this.prisma.mEMB_INFO.findFirst({
      where: { memb___id: username },
    });
    if (!account) throw new NotFoundException('La cuenta no existe');
    if (account.ctl1_code === '1') {
      throw new ForbiddenException('La cuenta está bloqueada');
    }
    return account;
  }

  private async isOnline(username: string) {
    const stat = await this.prisma.mEMB_STAT.findUnique({
      where: { memb___id: username },
      select: { ConnectStat: true },
    });
    return stat?.ConnectStat === 1;
  }

  /** Valida cuenta, propiedad del personaje y que la cuenta esté offline. */
  private async prepareAction(username: string, name: string) {
    const account = await this.findAccount(username);

    if (await this.isOnline(username)) {
      throw new ConflictException(
        'Tu cuenta está conectada al juego. Desconectate para usar esta opción.',
      );
    }

    const character = await this.prisma.character.findFirst({
      where: { Name: name, AccountID: username },
      select: CHARACTER_SELECT,
    });
    if (!character) {
      throw new NotFoundException('El personaje no existe en tu cuenta');
    }
    if (character.CtlCode === 1) {
      throw new ForbiddenException(`${character.Name} está bloqueado`);
    }

    const level: AccountLevel = effectiveAccountLevel(
      account.AccountLevel,
      account.AccountExpireDate,
    );
    return { account, character, rules: rulesFor(level) };
  }

  private assertUpdated(count: number) {
    if (count === 0) {
      throw new ConflictException(
        'El personaje cambió mientras se procesaba la acción. Recargá e intentá de nuevo.',
      );
    }
  }

  private async reload(username: string, name: string, rules: LevelRules) {
    const character = await this.prisma.character.findFirst({
      where: { Name: name, AccountID: username },
      select: CHARACTER_SELECT,
    });
    return character ? this.toView(character, rules) : null;
  }

  private statLabel(key: (typeof STAT_KEYS)[number][0]) {
    return {
      strength: 'Fuerza',
      dexterity: 'Agilidad',
      vitality: 'Vitalidad',
      energy: 'Energía',
      leadership: 'Comando',
    }[key];
  }

  private toView(c: CharacterRow, rules: LevelRules) {
    const level = c.cLevel ?? 1;
    const resets = c.ResetCount ?? 0;
    const money = c.Money ?? 0;
    const pkLevel = c.PkLevel ?? PK_NORMAL_LEVEL;

    const resetBlockers: string[] = [];
    if (resets >= rules.resetLimit) resetBlockers.push('Máximo de resets');
    if (level < rules.resetLevel)
      resetBlockers.push(`Nivel ${rules.resetLevel}`);
    if (money < rules.resetMoney)
      resetBlockers.push(`${rules.resetMoney.toLocaleString('es-AR')} zen`);

    return {
      name: c.Name,
      classId: c.Class ?? 0,
      className: classNameOf(c.Class),
      isDarkLord: baseClassOf(c.Class) === CLASS_CODES.DL,
      level,
      resets,
      freePoints: c.LevelUpPoint ?? 0,
      money,
      stats: {
        strength: c.Strength ?? 0,
        dexterity: c.Dexterity ?? 0,
        vitality: c.Vitality ?? 0,
        energy: c.Energy ?? 0,
        leadership: c.Leadership ?? 0,
      },
      pk: {
        level: pkLevel,
        count: c.PkCount ?? 0,
        isPk: pkLevel > PK_NORMAL_LEVEL,
      },
      map: {
        id: c.MapNumber ?? 0,
        name: mapNameOf(c.MapNumber),
        x: c.MapPosX ?? 0,
        y: c.MapPosY ?? 0,
      },
      banned: c.CtlCode === 1,
      canReset: resetBlockers.length === 0,
      resetBlockers,
    };
  }
}
