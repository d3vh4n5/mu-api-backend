/**
 * Reglas del juego usadas por el panel de cuenta.
 *
 * Deben coincidir con la configuración del GameServer:
 *  - mu-server-config/GameServer/DATA/GameServerInfo - Command.dat
 *  - mu-server-config/GameServer/DATA/GameServerInfo - Common.dat
 *  - mu-server-config/Data/Character/DefaultClassInfo.txt
 *  - mu-server-config/Data/Move/Gate.txt (gate 17 = zona segura de Lorencia)
 *
 * Si cambiás algo en el servidor, actualizalo también acá.
 */

export type AccountLevel = 0 | 1 | 2 | 3;

export type BaseClass = 0 | 1 | 2 | 3 | 4;

export const CLASS_CODES = {
  DW: 0,
  DK: 1,
  FE: 2,
  MG: 3,
  DL: 4,
} as const satisfies Record<string, BaseClass>;

/** Valores por nivel de cuenta (índice = AccountLevel 0..3). */
export const LEVEL_RULES = {
  resetLevel: [400, 390, 370, 350],
  resetMoney: [5_000_000, 4_000_000, 3_000_000, 1_000_000],
  resetPoint: [400, 500, 600, 800],
  resetCount: [1, 1, 1, 1],
  resetLimit: [300, 300, 300, 300],
  pkClearMoney: [5_000_000, 3_000_000, 1_500_000, 500_000],
  maxStatPoint: [32767, 32767, 32767, 32767],
} as const;

/** CommandResetStartLevel_AL* */
export const RESET_START_LEVEL = 1;

/** CommandResetPointRate{DW,DK,FE,MG,DL} (en %). */
export const RESET_POINT_RATE: Record<BaseClass, number> = {
  0: 100,
  1: 100,
  2: 100,
  3: 100,
  4: 100,
};

/** {DW,DK,FE,MG,DL}LevelUpPoint_AL* (iguales para todos los AL). */
export const LEVEL_UP_POINT: Record<BaseClass, number> = {
  0: 5,
  1: 5,
  2: 5,
  3: 7,
  4: 7,
};

export interface BaseStats {
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;
  leadership: number;
}

/** DefaultClassInfo.txt */
export const DEFAULT_STATS: Record<BaseClass, BaseStats> = {
  0: { strength: 18, dexterity: 18, vitality: 15, energy: 30, leadership: 0 },
  1: { strength: 28, dexterity: 20, vitality: 25, energy: 10, leadership: 0 },
  2: { strength: 22, dexterity: 25, vitality: 20, energy: 15, leadership: 0 },
  3: { strength: 26, dexterity: 26, vitality: 26, energy: 26, leadership: 0 },
  4: { strength: 26, dexterity: 20, vitality: 20, energy: 15, leadership: 25 },
};

/** Zona segura de Lorencia (Gate.txt, gate 17: 133-151 x 118-135). */
export const LORENCIA_SPAWN = { map: 0, x: 140, y: 125 } as const;

/** PkLevel: 1-2 héroe, 3 normal, 4+ asesino. */
export const PK_NORMAL_LEVEL = 3;

const CLASS_NAMES: Record<number, string> = {
  0: 'Dark Wizard',
  1: 'Soul Master',
  16: 'Dark Knight',
  17: 'Blade Knight',
  32: 'Fairy Elf',
  33: 'Muse Elf',
  48: 'Magic Gladiator',
  64: 'Dark Lord',
};

const MAP_NAMES: Record<number, string> = {
  0: 'Lorencia',
  1: 'Dungeon',
  2: 'Devias',
  3: 'Noria',
  4: 'Lost Tower',
  5: 'Exile',
  6: 'Arena',
  7: 'Atlans',
  8: 'Tarkan',
  9: 'Devil Square',
  10: 'Icarus',
  30: 'Valley of Loren',
  31: 'Land of Trials',
  32: 'Devil Square',
  33: 'Aida',
  34: 'Crywolf',
};

export function baseClassOf(classCode: number | null | undefined): BaseClass {
  const base = Math.floor((classCode ?? 0) / 16);
  return (base >= 0 && base <= 4 ? base : 0) as BaseClass;
}

export function classNameOf(classCode: number | null | undefined): string {
  const code = classCode ?? 0;
  return (
    CLASS_NAMES[code] ?? CLASS_NAMES[baseClassOf(code) * 16] ?? 'Desconocida'
  );
}

export function mapNameOf(mapNumber: number | null | undefined): string {
  const map = mapNumber ?? 0;
  if (map >= 11 && map <= 17) return `Blood Castle ${map - 10}`;
  if (map >= 18 && map <= 23) return `Chaos Castle ${map - 17}`;
  if (map >= 24 && map <= 29) return `Kalima ${map - 23}`;
  return MAP_NAMES[map] ?? `Mapa ${map}`;
}

/**
 * Nivel de cuenta efectivo: si el VIP venció, la cuenta vuelve a FREE (0),
 * igual que hace el JoinServer.
 */
export function effectiveAccountLevel(
  accountLevel: number | null | undefined,
  expireDate: Date | null | undefined,
  now: Date = new Date(),
): AccountLevel {
  const level = accountLevel ?? 0;
  if (level <= 0 || level > 3) return 0;
  if (!expireDate || expireDate.getTime() <= now.getTime()) return 0;
  return level as AccountLevel;
}

export function rulesFor(level: AccountLevel) {
  return {
    resetLevel: LEVEL_RULES.resetLevel[level],
    resetMoney: LEVEL_RULES.resetMoney[level],
    resetPoint: LEVEL_RULES.resetPoint[level],
    resetCount: LEVEL_RULES.resetCount[level],
    resetLimit: LEVEL_RULES.resetLimit[level],
    pkClearMoney: LEVEL_RULES.pkClearMoney[level],
    maxStatPoint: LEVEL_RULES.maxStatPoint[level],
  };
}

export type LevelRules = ReturnType<typeof rulesFor>;

/**
 * Puntos libres tras un reset con CommandResetType = 1 (borra stats):
 * resets * puntos_por_reset * rate + puntos del nivel inicial + frutas.
 */
export function computeResetPoints(params: {
  resets: number;
  resetPoint: number;
  baseClass: BaseClass;
  fruitAddPoint?: number;
}): number {
  const { resets, resetPoint, baseClass, fruitAddPoint = 0 } = params;
  const fromResets = Math.floor(
    (resets * resetPoint * RESET_POINT_RATE[baseClass]) / 100,
  );
  const fromLevel = (RESET_START_LEVEL - 1) * LEVEL_UP_POINT[baseClass];
  return fromResets + fromLevel + Math.max(0, fruitAddPoint);
}
