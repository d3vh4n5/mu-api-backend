import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    UserModule,
    RankingModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
