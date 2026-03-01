import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/res/healt-response.dto';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('/readiness')
  async getStatus() {
    const resp: HealthResponseDto = {
      api: 'ok',
      muServerDaemons: {
        gameServer: await this.healthService.checkService('GameServer'),
        joinServer: await this.healthService.checkService('JoinServer'),
        connectServer: await this.healthService.checkService('ConnectServer'),
        dataServer: await this.healthService.checkService('DataServer'),
      },
      muServer: {
        gameServer: (await this.healthService.checkPort(44405))
          ? 'ok'
          : 'error',
        joinServer: (await this.healthService.checkPort(44406))
          ? 'ok'
          : 'error',
        connectServer: (await this.healthService.checkPort(44407))
          ? 'ok'
          : 'error',
        dataServer: (await this.healthService.checkPort(44408))
          ? 'ok'
          : 'error',
      },
    };

    return resp;
  }
}
