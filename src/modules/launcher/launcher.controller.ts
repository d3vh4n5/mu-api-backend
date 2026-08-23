import { Controller, Get } from '@nestjs/common';
import { LauncherService } from './launcher.service';

@Controller('launcher')
export class LauncherController {
  constructor(private readonly launcherService: LauncherService) {}

  @Get('servers')
  getServers() {
    return this.launcherService.getServers();
  }
}
