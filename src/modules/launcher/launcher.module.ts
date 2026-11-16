import { Module } from '@nestjs/common';
import { LauncherService } from './launcher.service';
import { LauncherController } from './launcher.controller';
import { HealthModule } from '../health/health.module';
import { NewsModule } from '../news/news.module';

@Module({
  controllers: [LauncherController],
  providers: [LauncherService],
  imports: [HealthModule, NewsModule],
})
export class LauncherModule {}
