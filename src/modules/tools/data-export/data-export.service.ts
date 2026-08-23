import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async export() {
    const outputDir = join(process.cwd(), 'prisma', 'seed-data');

    await mkdir(outputDir, { recursive: true });

    this.logger.log('Obteniendo MEMB_INFO...');

    const membInfo = await this.prisma.mEMB_INFO.findMany();

    this.logger.log('Obteniendo AccountCharacter...');

    const accountCharacter = await this.prisma.accountCharacter.findMany();

    this.logger.log('Obteniendo Character...');

    const characters = await this.prisma.character.findMany();

    await writeFile(
      join(outputDir, 'memb-info.json'),
      JSON.stringify(membInfo, null, 2),
      'utf-8',
    );

    await writeFile(
      join(outputDir, 'account-character.json'),
      JSON.stringify(accountCharacter, null, 2),
      'utf-8',
    );

    await writeFile(
      join(outputDir, 'character.json'),
      JSON.stringify(characters, null, 2),
      'utf-8',
    );

    this.logger.log(
      `Exportación completada:
      MEMB_INFO: ${membInfo.length}
      AccountCharacter: ${accountCharacter.length}
      Character: ${characters.length}`,
    );
  }
}
