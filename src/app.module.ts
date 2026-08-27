import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { ConfigModule } from '@nestjs/config';
import { DataExportModule } from './modules/tools/data-export/data-export.module';
import { SeedModule } from './modules/seed/seed.module';
import { LauncherModule } from './modules/launcher/launcher.module';
import { PlayersModule } from './modules/players/players.module';
import { ServerResetModule } from './modules/tools/server-reset/server-reset.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    UserModule,
    RankingModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DataExportModule,
    SeedModule,
    LauncherModule,
    PlayersModule,
    ServerResetModule,
  ],
})
export class AppModule {}
