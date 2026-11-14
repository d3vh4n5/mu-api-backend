import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/res/health-response.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CONFIG } from '../../constants/config';

@Controller('health')
@UseGuards(ApiKeyGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('/readiness')
  async getStatus(): Promise<HealthResponseDto> {
    const ports = CONFIG.MU_PORTS;
    const portStatus = async (port: number) =>
      (await this.healthService.checkPort(port)) ? 'running' : 'stopped';

    const [
      gameDaemon,
      joinDaemon,
      connectDaemon,
      dataDaemon,
      connectPort,
      joinPort,
      gamePort,
      dataPort,
    ] = await Promise.all([
      this.healthService.checkService('GameServer'),
      this.healthService.checkService('JoinServer'),
      this.healthService.checkService('ConnectServer'),
      this.healthService.checkService('DataServer'),
      portStatus(ports.connectServer),
      portStatus(ports.joinServer),
      portStatus(ports.gameServer),
      portStatus(ports.dataServer),
    ]);

    return {
      api: 'ok',
      muServerDaemons: {
        gameServer: gameDaemon,
        joinServer: joinDaemon,
        connectServer: connectDaemon,
        dataServer: dataDaemon,
      },
      muServer: {
        connectServer: connectPort,
        joinServer: joinPort,
        gameServer: gamePort,
        dataServer: dataPort,
      },
    };
  }
}
