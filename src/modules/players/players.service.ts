import { Injectable } from '@nestjs/common';
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
}
