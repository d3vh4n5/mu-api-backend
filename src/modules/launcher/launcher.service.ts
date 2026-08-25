import { Injectable } from '@nestjs/common';
import { HealthService } from '../health/health.service';
import { manifest } from './data/manifest';

@Injectable()
export class LauncherService {
  constructor(private readonly healthService: HealthService) {}

  private readonly currentVersion = '1.2.5';

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
      // {
      //   id: 2,
      //   name: 'Mu Campana 99b Classic RPP',
      //   status: 'Online',
      //   fileUrl: '/downloads/Mu97Classic/ServerInfo.sse',
      //   registerUrl: 'https://www.mucampana.com/registro',
      // },
    );
    return servers;
  }

  getManifest() {
    return manifest;
  }

  getLauncherInfo(version: string) {
    const needUpdate = version
      ? this.isVersionGreater(this.currentVersion, version)
      : false;

    return {
      name: 'launcher.exe',
      registerUrl: 'https://mu-front.vercel.app/register',
      frontEndUrl: 'https://mu-front.vercel.app',
      launcherUrl:
        process.env.MU_SERVER_URL +
        '/downloads/Mu99bClassic/Client/launcher.exe',
      updaterUrl:
        process.env.MU_SERVER_URL +
        '/downloads/Mu99bClassic/Client/updater.exe',
      version: this.currentVersion,
      currentVersion: this.currentVersion,
      clientVersion: version ?? null,
      needUpdate,
    };
  }

  private isVersionGreater(version: string, otherVersion: string) {
    const currentParts = this.parseVersion(version);
    const otherParts = this.parseVersion(otherVersion);
    const length = Math.max(currentParts.length, otherParts.length);

    for (let index = 0; index < length; index += 1) {
      const currentPart = currentParts[index] ?? 0;
      const otherPart = otherParts[index] ?? 0;

      if (currentPart !== otherPart) {
        return currentPart > otherPart;
      }
    }

    return false;
  }

  private parseVersion(version: string) {
    return version
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isNaN(part) ? 0 : part));
  }
}
