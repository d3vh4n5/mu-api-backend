import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from '../../../generated/prisma/client.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

type SeedRecord = Record<string, unknown>;

const dateFields = [
  'appl_days',
  'modi_days',
  'out__days',
  'true_days',
  'AccountExpireDate',
  'MDate',
  'LDate',
] as const;

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async loadJson<T>(filename: string): Promise<T> {
    const path = join(process.cwd(), 'prisma', 'seed-data', filename);

    const content = await readFile(path, 'utf-8');

    return JSON.parse(content) as T;
  }

  private bufferFromJson(value: unknown): Buffer | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (Buffer.isBuffer(value)) {
      return value;
    }

    if (typeof value !== 'object') {
      throw new TypeError(
        'El valor binario del seed debe ser un objeto o Buffer',
      );
    }

    const jsonValue = value as { type?: unknown; data?: unknown } & SeedRecord;
    if (jsonValue.type === 'Buffer' && Array.isArray(jsonValue.data)) {
      return Buffer.from(jsonValue.data as number[]);
    }

    const byteKeys = Object.keys(value)
      .filter((key) => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right));

    if (
      byteKeys.length > 0 &&
      byteKeys.every((key) => Number(value[key]) >= 0)
    ) {
      return Buffer.from(byteKeys.map((key) => Number(value[key])));
    }

    throw new TypeError('El valor binario del seed no tiene un formato válido');
  }

  private datesFromJson(record: SeedRecord): SeedRecord {
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        dateFields.includes(key as (typeof dateFields)[number]) &&
        (typeof value === 'string' || typeof value === 'number')
          ? new Date(value)
          : value,
      ]),
    );
  }

  async execute() {
    this.logger.log('Iniciando seed...');

    const membInfo = (await this.loadJson<SeedRecord[]>('memb-info.json')).map(
      (record) => {
        const account = { ...record };
        delete account.memb_guid;
        return this.datesFromJson(account) as Prisma.MEMB_INFOCreateManyInput;
      },
    );

    const accountCharacter = (
      await this.loadJson<SeedRecord[]>('account-character.json')
    ).map((record) => {
      const account = { ...record };
      delete account.Number;
      return account as Prisma.AccountCharacterCreateManyInput;
    });

    const characters = (
      await this.loadJson<SeedRecord[]>('character.json')
    ).map(
      (character) =>
        ({
          ...this.datesFromJson(character),

          Inventory: this.bufferFromJson(character.Inventory),
          MagicList: this.bufferFromJson(character.MagicList),
          Quest: this.bufferFromJson(character.Quest),
          EffectList: this.bufferFromJson(character.EffectList),
        }) as Prisma.CharacterCreateManyInput,
    );

    this.logger.log(`MEMB_INFO: ${membInfo.length}`);
    this.logger.log(`AccountCharacter: ${accountCharacter.length}`);
    this.logger.log(`Character: ${characters.length}`);

    /*
     * Orden de inserción:
     *
     * MEMB_INFO
     *      ↓
     * AccountCharacter
     *      ↓
     * Character
     */

    await this.prisma.$transaction(async (tx) => {
      await tx.character.deleteMany();
      await tx.accountCharacter.deleteMany();
      await tx.mEMB_INFO.deleteMany();

      await tx.mEMB_INFO.createMany({
        data: membInfo,
      });

      await tx.accountCharacter.createMany({
        data: accountCharacter,
      });

      await tx.character.createMany({
        data: characters,
      });
    });

    this.logger.log('Seed completado correctamente');

    return {
      membInfo: membInfo.length,
      accountCharacter: accountCharacter.length,
      characters: characters.length,
    };
  }
}
