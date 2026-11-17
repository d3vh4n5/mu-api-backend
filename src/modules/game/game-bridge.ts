import type { IncomingMessage, Server } from 'node:http';
import { connect, type Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * Puente WebSocket ↔ TCP para la versión web del cliente 3D (`/game/ws?port=N`).
 *
 * El navegador no puede abrir TCP: manda los bytes del protocolo MU por WebSocket y el puente los
 * reenvía, sin interpretarlos, al ConnectServer o a un GameServer de esta misma máquina. Solo conecta a
 * `host` y a los puertos permitidos (no es un proxy abierto) y limita conexiones por IP real, porque
 * el server MU ve a todos los jugadores web como 127.0.0.1.
 */
export interface BridgeConfig {
  host: string;
  ports: Set<number>;
  maxPerIp: number;
  idleMs: number;
  /** Orígenes permitidos además del mismo host (p. ej. el servidor de desarrollo de Vite). */
  extraOrigins: string[];
}

export interface BridgeDeps {
  isBlocked(ip: string): boolean;
  /** Si hay un proxy delante, la IP real viene en X-Forwarded-For. */
  trustProxy: boolean;
  log(msg: string): void;
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function bridgeConfigFromEnv(env: NodeJS.ProcessEnv): BridgeConfig {
  const connectPort = Number(env.MU_PORT_CONNECT ?? 44405);
  const ports = env.GAME_BRIDGE_PORTS
    ? list(env.GAME_BRIDGE_PORTS).map(Number)
    : [connectPort, 55900, 55901];
  return {
    host: env.MU_SERVER_HOST || '127.0.0.1',
    ports: new Set(ports.filter((p) => Number.isInteger(p) && p > 0)),
    maxPerIp: Number(env.GAME_MAX_PER_IP ?? 4),
    idleMs: Number(env.GAME_IDLE_SECONDS ?? 300) * 1000,
    extraOrigins: list(env.GAME_ALLOWED_ORIGINS),
  };
}

/** Solo páginas del mismo host (o de los orígenes extra). Sin Origin no es un navegador: se rechaza. */
export function originAllowed(
  origin: string | undefined,
  host: string | undefined,
  extra: string[],
): boolean {
  if (!origin) return false;
  if (extra.includes(origin)) return true;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function realIp(req: IncomingMessage, trustProxy: boolean): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  const ip = (trustProxy && first) || req.socket.remoteAddress || 'unknown';
  return ip.replace(/^::ffff:/, '');
}

function reject(socket: Duplex, status: string): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachGameBridge(
  server: Server,
  cfg: BridgeConfig,
  deps: BridgeDeps,
): { close(): Promise<void> } {
  const wss = new WebSocketServer({ noServer: true });
  const perIp = new Map<string, number>();
  const live = new Set<{ ws: WebSocket; tcp: Socket }>();

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/game/ws') return reject(socket, '404 Not Found');
    const ip = realIp(req, deps.trustProxy);
    const port = Number(url.searchParams.get('port'));
    if (!cfg.ports.has(port)) return reject(socket, '403 Forbidden');
    if (!originAllowed(req.headers.origin, req.headers.host, cfg.extraOrigins))
      return reject(socket, '403 Forbidden');
    if (deps.isBlocked(ip)) return reject(socket, '403 Forbidden');
    if ((perIp.get(ip) ?? 0) >= cfg.maxPerIp)
      return reject(socket, '429 Too Many Requests');

    // El cupo se cuenta recién con el handshake hecho: si falla, ws corta el socket sin llamar al callback.
    wss.handleUpgrade(req, socket, head, (ws) => {
      perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
      bridge(ws, ip, port);
    });
  };

  function bridge(ws: WebSocket, ip: string, port: number): void {
    const tcp = connect(port, cfg.host);
    const entry = { ws, tcp };
    live.add(entry);
    const queued: Buffer[] = [];
    let connected = false;
    let up = 0;
    let down = 0;
    let done = false;
    let idle: NodeJS.Timeout;
    const touch = () => {
      clearTimeout(idle);
      idle = setTimeout(() => finish('sin tráfico'), cfg.idleMs);
    };

    const finish = (reason: string) => {
      if (done) return;
      done = true;
      clearTimeout(idle);
      live.delete(entry);
      const n = (perIp.get(ip) ?? 1) - 1;
      if (n <= 0) perIp.delete(ip);
      else perIp.set(ip, n);
      tcp.destroy();
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING)
        ws.close(1000, reason.slice(0, 100));
      deps.log(
        `[game] ${ip} → :${port} cerrada (${reason}); ↑${up} B ↓${down} B`,
      );
    };

    deps.log(`[game] ${ip} → :${port} abierta`);
    touch();
    tcp.on('connect', () => {
      connected = true;
      for (const b of queued.splice(0)) tcp.write(b);
    });
    tcp.on('data', (d) => {
      down += d.length;
      touch();
      ws.send(d);
    });
    tcp.on('error', (e) => finish(`error TCP: ${e.message}`));
    tcp.on('close', () => finish('el servidor cerró la conexión'));
    ws.on('message', (data: Buffer) => {
      up += data.length;
      touch();
      if (connected) tcp.write(data);
      else queued.push(data);
    });
    ws.on('close', () => finish('el jugador cerró la conexión'));
    ws.on('error', (e) => finish(`error WebSocket: ${e.message}`));
  }

  server.on('upgrade', onUpgrade);

  return {
    async close() {
      server.off('upgrade', onUpgrade);
      for (const { ws, tcp } of [...live]) {
        tcp.destroy();
        ws.terminate();
      }
      await new Promise<void>((r) => wss.close(() => r()));
    },
  };
}
