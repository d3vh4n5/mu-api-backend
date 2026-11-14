import { existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { IpBlocklistService } from '../common/security/ip-blocklist.service';
import {
  clientIp,
  headerValue,
  matchesAnyKey,
} from '../common/security/request-utils';
import { manifest } from '../modules/launcher/data/manifest';

/**
 * Sirve `public/downloads` en `/downloads` (fuera del prefijo /api/v2), como
 * hacía `express.static` en la API vieja. Lo usa el Launcher para:
 *  - /downloads/Mu99bClassic/manifest.json
 *  - /downloads/Mu99bClassic/Client/<archivo>
 *  - el `fileUrl` de /api/v2/launcher/servers (ServerInfo.sse)
 *
 * Igual que el `guardian` viejo, exige `x-api-key`. Se acepta LAUNCHER_API_KEY
 * (la key que viaja dentro del launcher) o SECRET_API_KEY.
 * DOWNLOADS_REQUIRE_KEY=false lo deja público.
 */
export function setupDownloads(
  app: NestExpressApplication,
  blocklist: IpBlocklistService,
) {
  const logger = new Logger('Downloads');
  const publicDir = process.env.PUBLIC_DIR || join(process.cwd(), 'public');
  const downloadsDir = join(publicDir, 'downloads');
  const requireKey = process.env.DOWNLOADS_REQUIRE_KEY !== 'false';

  if (!existsSync(downloadsDir)) {
    logger.warn(
      `No existe ${downloadsDir}: el launcher no podrá descargar archivos`,
    );
  } else {
    logger.log(`Sirviendo ${downloadsDir} en /downloads`);
  }

  if (requireKey && !process.env.LAUNCHER_API_KEY) {
    logger.warn(
      'LAUNCHER_API_KEY no definida: /downloads solo acepta SECRET_API_KEY',
    );
  }

  if (requireKey) {
    app.use('/downloads', (req: Request, res: Response, next: NextFunction) => {
      const valid = matchesAnyKey(headerValue(req, 'x-api-key'), [
        process.env.LAUNCHER_API_KEY,
        process.env.SECRET_API_KEY,
      ]);
      const ip = clientIp(req);

      if (!valid) {
        blocklist.registerFailure(ip);
        res.status(401).json({ statusCode: 401, message: 'No autorizado' });
        return;
      }

      blocklist.registerSuccess(ip);
      next();
    });
  }

  app.useStaticAssets(downloadsDir, {
    prefix: '/downloads',
    index: false,
    dotfiles: 'ignore',
    fallthrough: true,
  });

  // Si public/downloads/Mu99bClassic/manifest.json no existe en disco
  // (git pull lo borra del repo), se sirve el manifest embebido en la API.
  app
    .getHttpAdapter()
    .get(
      '/downloads/Mu99bClassic/manifest.json',
      (_req: Request, res: Response) => {
        res.json(manifest);
      },
    );
}
