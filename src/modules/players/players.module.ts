import { Module } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [PlayersController],
  providers: [PlayersService, PrismaService, AdminGuard],
})
export class PlayersModule {}
