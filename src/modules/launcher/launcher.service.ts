import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { HealthService } from '../health/health.service';
import { getDownloadsDir } from '../../downloads/setup-downloads';
import { manifest } from './data/manifest';
import { getPublishedFileInfo } from './published-file';
import { LAUNCHER_REL_PATH, UPDATER_REL_PATH } from './paths';

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
   *
   * Rollback: con LAUNCHER_ALLOW_DOWNGRADE=true se actualiza a cualquier versión
   * DISTINTA de la publicada (también hacia atrás). Así, para deshacer una versión
   * rota alcanza con volver a subir el launcher.exe anterior.
   */
  async getLauncherInfo(version: string) {
    const [launcher, updater] = await Promise.all([
      getPublishedFileInfo(join(getDownloadsDir(), LAUNCHER_REL_PATH)),
      getPublishedFileInfo(join(getDownloadsDir(), UPDATER_REL_PATH)),
    ]);
    const currentVersion = launcher?.version ?? null;

    if (!launcher) {
      this.logger.warn(`No existe ${LAUNCHER_REL_PATH} en downloads`);
    } else if (!currentVersion) {
      this.logger.warn(`${LAUNCHER_REL_PATH} no tiene metadatos de versión`);
    }

    const allowDowngrade = process.env.LAUNCHER_ALLOW_DOWNGRADE === 'true';
    const needUpdate =
      !!version &&
      !!currentVersion &&
      (allowDowngrade
        ? this.compareVersions(currentVersion, version) !== 0
        : this.compareVersions(currentVersion, version) > 0);

    return {
      name: 'launcher.exe',
      registerUrl: 'https://mu-front.vercel.app/register',
      frontEndUrl: 'https://mu-front.vercel.app',
      launcherUrl:
        process.env.MU_SERVER_URL + '/downloads/' + LAUNCHER_REL_PATH,
      launcherSha256: launcher?.sha256 ?? null,
      launcherSize: launcher?.size ?? null,
      updaterUrl: process.env.MU_SERVER_URL + '/downloads/' + UPDATER_REL_PATH,
      updaterSha256: updater?.sha256 ?? null,
      updaterSize: updater?.size ?? null,
      version: currentVersion,
      currentVersion,
      clientVersion: version ?? null,
      needUpdate,
    };
  }

  /** >0 si version es mayor, <0 si es menor, 0 si son iguales ("1.2" == "1.2.0"). */
  private compareVersions(version: string, otherVersion: string) {
    const currentParts = this.parseVersion(version);
    const otherParts = this.parseVersion(otherVersion);
    const length = Math.max(currentParts.length, otherParts.length);

    for (let index = 0; index < length; index += 1) {
      const currentPart = currentParts[index] ?? 0;
      const otherPart = otherParts[index] ?? 0;

      if (currentPart !== otherPart) {
        return currentPart - otherPart;
      }
    }

    return 0;
  }

  private parseVersion(version: string) {
    return version
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isNaN(part) ? 0 : part));
  }
}
