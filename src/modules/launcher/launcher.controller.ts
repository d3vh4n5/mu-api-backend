import { Controller, Get, Query } from '@nestjs/common';
import { LauncherService } from './launcher.service';
import { GetVersionDto } from './dto/version.dto';

@Controller('launcher')
export class LauncherController {
  constructor(private readonly launcherService: LauncherService) {}

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
