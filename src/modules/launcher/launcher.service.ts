import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { HealthService } from '../health/health.service';
import { getDownloadsDir } from '../../downloads/setup-downloads';
import { manifest } from './data/manifest';
import { getPublishedFileInfo } from './published-file';

/** Ruta del launcher dentro de /downloads (la misma que launcherUrl). */
const LAUNCHER_REL_PATH = 'Mu99bClassic/Client/launcher.exe';

@Injectable()
export class LauncherService {
  private readonly logger = new Logger(LauncherService.name);

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

  /**
   * La versión publicada sale de los metadatos del launcher.exe que está en
   * /downloads: subir un exe nuevo alcanza para publicar una versión.
   * Si el exe no está o no tiene versión, nadie actualiza.
   */
  async getLauncherInfo(version: string) {
    const launcher = await getPublishedFileInfo(
      join(getDownloadsDir(), LAUNCHER_REL_PATH),
    );
    const currentVersion = launcher?.version ?? null;

    if (!launcher) {
      this.logger.warn(`No existe ${LAUNCHER_REL_PATH} en downloads`);
    } else if (!currentVersion) {
      this.logger.warn(`${LAUNCHER_REL_PATH} no tiene metadatos de versión`);
    }

    const needUpdate =
      !!version &&
      !!currentVersion &&
      this.isVersionGreater(currentVersion, version);

    return {
      name: 'launcher.exe',
      registerUrl: 'https://mu-front.vercel.app/register',
      frontEndUrl: 'https://mu-front.vercel.app',
      launcherUrl:
        process.env.MU_SERVER_URL + '/downloads/' + LAUNCHER_REL_PATH,
      updaterUrl:
        process.env.MU_SERVER_URL +
        '/downloads/Mu99bClassic/Client/Data/Launcher/updater.exe',
      version: currentVersion,
      currentVersion,
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
