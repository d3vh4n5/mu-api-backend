import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { getPublicDir } from '../../downloads/setup-downloads';

/**
 * Versión web del juego, servida por la misma API (mismo origen que el puente /game/ws):
 *  - /jugar/              → el build web del cliente 3D (PUBLIC_DIR/jugar)
 *  - /game/data/client/*  → la Data del cliente MU (la que ya publica Client Tools para el Launcher)
 *  - /game/data/server/*  → solo terreno, Item.txt y MonsterList.txt de la config del server
 * Todo público y de solo lectura: el navegador no puede guardar la x-api-key de /downloads.
 */
export interface GameStaticDirs {
  page: string;
  clientData: string;
  serverData: string;
}

export function gameStaticDirsFromEnv(env: NodeJS.ProcessEnv): GameStaticDirs {
  const pub = getPublicDir();
  return {
    page: join(pub, 'jugar'),
    clientData:
      env.GAME_CLIENT_DATA_DIR ||
      join(pub, 'downloads', 'Mu99bClassic', 'Client', 'Data'),
    serverData:
      env.GAME_SERVER_DATA_DIR ||
      join(process.cwd(), '..', 'mu-server-config', 'Data'),
  };
}

const SERVER_FILES = [
  /^terrain\/[a-z0-9_]+\.att$/,
  /^item\/item\.txt$/,
  /^monster\/monsterlist\.txt$/,
];

/** ¿Se puede publicar este archivo de la config del server? (ruta relativa con `/`) */
export function serverDataAllowed(relPath: string): boolean {
  const p = relPath.toLowerCase();
  if (posix.normalize(p) !== p || p.includes('..')) return false;
  return SERVER_FILES.some((re) => re.test(p));
}

/** CSP de la página: WebGL con texturas en blob:/data:, workers y el WebSocket del puente. */
const PAGE_CSP = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'blob:', 'data:'],
    connectSrc: ["'self'", 'ws:', 'wss:', 'blob:', 'data:'],
    workerSrc: ["'self'", 'blob:'],
    // Mientras el VPS no tenga SSL, la página y sus archivos van por http.
    upgradeInsecureRequests: null,
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function setupGameStatic(
  app: NestExpressApplication,
  dirs: GameStaticDirs,
): void {
  const logger = new Logger('GameStatic');
  for (const [name, dir] of Object.entries(dirs) as [string, string][]) {
    if (!existsSync(dir))
      logger.warn(`No existe ${dir} (${name}): la versión web no va a andar`);
  }

  const readOnly = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    res.status(404).end();
  };

  app.use(
    '/jugar',
    helmet({ contentSecurityPolicy: PAGE_CSP, strictTransportSecurity: false }),
    express.static(dirs.page, { index: 'index.html', dotfiles: 'ignore' }),
  );

  app.use(
    '/game/data/client',
    readOnly,
    express.static(dirs.clientData, {
      index: false,
      dotfiles: 'ignore',
      maxAge: 7 * DAY_MS,
      fallthrough: false,
    }),
  );

  app.use(
    '/game/data/server',
    readOnly,
    (req: Request, res: Response, next: NextFunction) => {
      let rel: string;
      try {
        rel = decodeURIComponent(req.path).replace(/^\/+/, '');
      } catch {
        return void res.status(404).end();
      }
      if (!serverDataAllowed(rel)) return void res.status(404).end();
      next();
    },
    express.static(dirs.serverData, {
      index: false,
      dotfiles: 'ignore',
      maxAge: DAY_MS,
      fallthrough: false,
    }),
  );
}
