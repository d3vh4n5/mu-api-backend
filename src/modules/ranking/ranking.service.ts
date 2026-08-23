import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  async getRanking() {
    return this.prisma.$queryRaw<
      {
        Name: string;
        Class: number | null;
        cLevel: number | null;
        Resets: number;
      }[]
    >`
      SELECT TOP 10
        C.Name,
        C.Class,
        C.cLevel,
        ISNULL(C.ResetCount, 0) AS Resets
      FROM Character C
      JOIN MEMB_INFO M
        ON C.AccountID = M.memb___id
      WHERE M.ctl1_code = '0'
        AND C.CtlCode = 0
      ORDER BY C.ResetCount DESC, C.cLevel DESC
    `;
  }

  findOne(id: number) {
    return `This action returns a #${id} ranking`;
  }
}
