import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { DataExportModule } from './modules/tools/data-export/data-export.module';
import { SeedModule } from './modules/seed/seed.module';
import { LauncherModule } from './modules/launcher/launcher.module';
import { PlayersModule } from './modules/players/players.module';
import { ServerResetModule } from './modules/tools/server-reset/server-reset.module';
import { AccountModule } from './modules/account/account.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './common/security/security.module';
import { AppThrottlerGuard } from './common/security/app-throttler.guard';

// El seed BORRA MEMB_INFO/Character/AccountCharacter: solo se registra en desarrollo.
const devOnlyModules =
  process.env.NODE_ENV === 'development' ? [SeedModule] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
      },
    ]),
    PrismaModule,
    SecurityModule,
    HealthModule,
    AuthModule,
    UserModule,
    RankingModule,
    DataExportModule,
    LauncherModule,
    PlayersModule,
    ServerResetModule,
    AccountModule,
    AdminModule,
    ...devOnlyModules,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
