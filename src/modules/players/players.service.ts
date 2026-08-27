import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllOnline() {
    const count = await this.prisma.mEMB_STAT.count({
      where: {
        ConnectStat: 1,
      },
    });
    return {
      online: count,
    };
  }

  async makeCharacterAdmin(name: string) {
    const character = await this.prisma.character.findUnique({
      where: { Name: name },
    });

    if (!character) {
      throw new NotFoundException(`El personaje "${name}" no existe`);
    }

    await this.prisma.character.update({
      where: { Name: name },
      data: { CtlCode: 32 },
    });

    return { name, ctlCode: 32, message: 'El personaje ahora es admin' };
  }

  async banCharacter(name: string) {
    const character = await this.prisma.character.findUnique({
      where: { Name: name },
    });

    if (!character) {
      throw new NotFoundException(`El personaje "${name}" no existe`);
    }

    await this.prisma.character.update({
      where: { Name: name },
      data: { CtlCode: 1 },
    });

    return { name, ctlCode: 1, message: 'El personaje fue baneado' };
  }

  async normalizeCharacter(name: string) {
    const character = await this.prisma.character.findUnique({
      where: { Name: name },
    });

    if (!character) {
      throw new NotFoundException(`El personaje "${name}" no existe`);
    }

    await this.prisma.character.update({
      where: { Name: name },
      data: { CtlCode: 0 },
    });

    return { name, ctlCode: 0, message: 'El personaje volvió a ser normal' };
  }

  async banAccount(username: string) {
    const result = await this.prisma.mEMB_INFO.updateMany({
      where: { memb___id: username },
      data: { ctl1_code: '1' },
    });

    if (result.count === 0) {
      throw new NotFoundException(`La cuenta "${username}" no existe`);
    }

    return { username, controlCode: '1', message: 'La cuenta fue baneada' };
  }

  async normalizeAccount(username: string) {
    const result = await this.prisma.mEMB_INFO.updateMany({
      where: { memb___id: username },
      data: { ctl1_code: '0' },
    });

    if (result.count === 0) {
      throw new NotFoundException(`La cuenta "${username}" no existe`);
    }

    return {
      username,
      controlCode: '0',
      message: 'La cuenta fue desbaneada y volvió a ser normal',
    };
  }
}
