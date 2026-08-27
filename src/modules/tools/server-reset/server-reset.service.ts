import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ServerResetDto } from './dto/server-reset.dto';

@Injectable()
export class ServerResetService {
  constructor(private readonly prisma: PrismaService) {}

  async reset(options: ServerResetDto) {
    const resetCharacters = options.resetCharacters ?? true;
    const resetMembInfo = options.resetMembInfo ?? false;
    const resetWarehouses = options.resetWarehouses ?? true;
    const resetGuilds = options.resetGuilds ?? true;
    const resetRankings = options.resetRankings ?? true;
    const resetSocialData = options.resetSocialData ?? true;

    if (resetMembInfo && !resetCharacters) {
      throw new BadRequestException(
        'resetMembInfo requiere resetCharacters=true para evitar datos huérfanos',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      if (resetSocialData) {
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[T_FriendMail]');
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[T_FriendList]');
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[T_WaitFriend]');
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[T_FriendMain]');
      }

      if (resetGuilds) {
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[GuildMember]');
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[Guild]');
      }

      if (resetCharacters) {
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[Character]');
        await transaction.$executeRawUnsafe(
          'DELETE FROM [dbo].[AccountCharacter]',
        );
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[OptionData]');
        await transaction.$executeRawUnsafe(
          'DELETE FROM [dbo].[T_PetItem_Info]',
        );
      }

      if (resetWarehouses) {
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[warehouse]');
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[ExtWarehouse]');
      }

      if (resetRankings) {
        await transaction.$executeRawUnsafe(
          'DELETE FROM [dbo].[RankingBloodCastle]',
        );
        await transaction.$executeRawUnsafe(
          'DELETE FROM [dbo].[RankingChaosCastle]',
        );
        await transaction.$executeRawUnsafe(
          'DELETE FROM [dbo].[RankingDevilSquare]',
        );
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[RankingDuel]');
      }

      await transaction.$executeRawUnsafe('DELETE FROM [dbo].[MEMB_STAT]');
      await transaction.$executeRawUnsafe('DELETE FROM [dbo].[ResetData]');
      await transaction.$executeRawUnsafe(
        'DELETE FROM [dbo].[EventEntryCount]',
      );
      await transaction.$executeRawUnsafe(
        'DELETE FROM [dbo].[EventGoldenArcher]',
      );

      if (resetMembInfo) {
        await transaction.$executeRawUnsafe('DELETE FROM [dbo].[MEMB_INFO]');
      }
    });

    return {
      message: resetMembInfo
        ? 'Datos del servidor y cuentas eliminados correctamente'
        : 'Datos del servidor eliminados correctamente; MEMB_INFO se conservó',
      resetCharacters,
      resetMembInfo,
      resetWarehouses,
      resetGuilds,
      resetRankings,
      resetSocialData,
    };
  }
}
