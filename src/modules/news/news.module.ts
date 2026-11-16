import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthModule } from '../auth/auth.module';
import { AdminNewsController, NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [AuthModule],
  controllers: [NewsController, AdminNewsController],
  providers: [NewsService, AdminGuard],
  exports: [NewsService],
})
export class NewsModule {}
