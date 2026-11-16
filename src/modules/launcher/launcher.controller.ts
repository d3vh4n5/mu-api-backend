import { Controller, Get, Query } from '@nestjs/common';
import { LauncherService } from './launcher.service';
import { GetVersionDto } from './dto/version.dto';
import { NewsService } from '../news/news.service';

@Controller('launcher')
export class LauncherController {
  constructor(
    private readonly launcherService: LauncherService,
    private readonly newsService: NewsService,
  ) {}

  /** Últimas noticias, resumidas (título, categoría, fecha y link a la web). */
  @Get('news')
  getNews() {
    return this.newsService.listForLauncher(5);
  }

  @Get()
  getLauncherInfo(@Query() dto: GetVersionDto) {
    return this.launcherService.getLauncherInfo(dto.version);
  }

  @Get('servers')
  getServers() {
    return this.launcherService.getServers();
  }

  @Get('manifest')
  getManifest() {
    return this.launcherService.getManifest();
  }
}
