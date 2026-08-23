import { Injectable } from '@nestjs/common';
import { HealthService } from '../health/health.service';

@Injectable()
export class LauncherService {
  constructor(private readonly healthService: HealthService) {}

  async getServers() {
    const status = await this.healthService.checkService('GameServer');
    console.log(status);
    // res.json(status);
    const servers: Array<{
      id: number;
      name: string;
      status: string;
      fileUrl: string;
      registerUrl: string;
    }> = [];
    servers.push(
      {
        id: 1,
        name: 'Mu Campana 99b Classic',
        status: 'Online',
        fileUrl: '/downloads/Mu99bClassic/Client/ServerInfo.sse',
        registerUrl: 'https://mu-front.vercel.app/register',
      },
      {
        id: 2,
        name: 'Mu Campana 99b Classic RPP',
        status: 'Online',
        fileUrl: '/downloads/Mu97Classic/ServerInfo.sse',
        registerUrl: 'https://www.mucampana.com/registro',
      },
    );
    return servers;
  }
}
