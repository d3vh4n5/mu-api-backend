import { createServer, request as httpRequest, type Server } from 'node:http';
import {
  createServer as createTcpServer,
  type Server as TcpServer,
  type Socket,
} from 'node:net';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import {
  attachGameBridge,
  bridgeConfigFromEnv,
  originAllowed,
  type BridgeConfig,
} from './game-bridge';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const portOf = (s: { address(): unknown }) => (s.address() as AddressInfo).port;

describe('bridgeConfigFromEnv', () => {
  it('usa los puertos MU, 4 por IP y 300 s por defecto', () => {
    const c = bridgeConfigFromEnv({});
    expect([...c.ports].sort()).toEqual([44405, 55900, 55901]);
    expect(c.maxPerIp).toBe(4);
    expect(c.idleMs).toBe(300_000);
    expect(c.host).toBe('127.0.0.1');
  });

  it('lee GAME_BRIDGE_PORTS y GAME_ALLOWED_ORIGINS', () => {
    const c = bridgeConfigFromEnv({
      GAME_BRIDGE_PORTS: '1, 2',
      GAME_ALLOWED_ORIGINS: 'http://localhost:5173, http://a',
    });
    expect([...c.ports].sort()).toEqual([1, 2]);
    expect(c.extraOrigins).toEqual(['http://localhost:5173', 'http://a']);
  });
});

describe('originAllowed', () => {
  it('permite el mismo host y los extra; rechaza otros y la falta de Origin', () => {
    expect(originAllowed('http://1.2.3.4:3000', '1.2.3.4:3000', [])).toBe(true);
    expect(
      originAllowed('http://localhost:5173', '1.2.3.4:3000', [
        'http://localhost:5173',
      ]),
    ).toBe(true);
    expect(originAllowed('http://malo.com', '1.2.3.4:3000', [])).toBe(false);
    expect(originAllowed(undefined, '1.2.3.4:3000', [])).toBe(false);
  });
});

describe('puente /game/ws', () => {
  let http: Server;
  let echo: TcpServer;
  let greeter: TcpServer;
  let bridge: { close(): Promise<void> };
  let tcpSockets: Socket[];
  let blocked: Set<string>;
  let cfg: BridgeConfig;
  const logs: string[] = [];

  const open = (port: number, origin?: string) => {
    const url = `ws://127.0.0.1:${portOf(http)}/game/ws?port=${port}`;
    return new WebSocket(url, {
      origin: origin ?? `http://127.0.0.1:${portOf(http)}`,
    });
  };
  const opened = (ws: WebSocket) =>
    new Promise<void>((res, rej) => {
      ws.once('open', () => res());
      ws.once('error', rej);
      ws.once('unexpected-response', () => rej(new Error('rechazado')));
    });
  const closedWs = (ws: WebSocket) =>
    new Promise<void>((res) =>
      ws.readyState === WebSocket.CLOSED
        ? res()
        : ws.once('close', () => res()),
    );

  beforeEach(async () => {
    tcpSockets = [];
    blocked = new Set();
    echo = createTcpServer((s) => {
      tcpSockets.push(s);
      s.on('data', (d) => s.write(d));
      s.on('error', () => {});
    });
    greeter = createTcpServer((s) => {
      tcpSockets.push(s);
      s.write(Buffer.from([0xc1, 4, 0, 1]));
      s.on('error', () => {});
    });
    await Promise.all([
      new Promise<void>((r) => echo.listen(0, '127.0.0.1', r)),
      new Promise<void>((r) => greeter.listen(0, '127.0.0.1', r)),
    ]);
    http = createServer();
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    cfg = {
      host: '127.0.0.1',
      ports: new Set([portOf(echo), portOf(greeter)]),
      maxPerIp: 4,
      idleMs: 60_000,
      extraOrigins: [],
    };
    bridge = attachGameBridge(http, cfg, {
      isBlocked: (ip) => blocked.has(ip),
      trustProxy: false,
      log: (m) => logs.push(m),
    });
  });

  afterEach(async () => {
    await bridge.close();
    for (const s of tcpSockets) s.destroy();
    await Promise.all([
      new Promise((r) => http.close(r)),
      new Promise((r) => echo.close(r)),
      new Promise((r) => greeter.close(r)),
    ]);
  });

  it('rechaza puertos fuera de la lista sin conectar al TCP', async () => {
    const ws = open(1);
    await expect(opened(ws)).rejects.toThrow();
    expect(tcpSockets).toHaveLength(0);
  });

  it('rechaza un Origin de otro sitio', async () => {
    await expect(
      opened(open(portOf(echo), 'http://malo.com')),
    ).rejects.toThrow();
  });

  it('reenvía bytes intactos en los dos sentidos', async () => {
    const ws = open(portOf(echo));
    await opened(ws);
    const got = new Promise<number[]>((r) =>
      ws.once('message', (d: Buffer) => r([...d])),
    );
    ws.send(Buffer.from([1, 2, 3, 250]));
    expect(await got).toEqual([1, 2, 3, 250]);
    ws.close();
  });

  it('entrega lo que el server manda apenas conecta', async () => {
    const ws = open(portOf(greeter));
    const got = new Promise<number[]>((r) =>
      ws.once('message', (d: Buffer) => r([...d])),
    );
    await opened(ws);
    expect(await got).toEqual([0xc1, 4, 0, 1]);
    ws.close();
  });

  it('cerrar el WebSocket cierra el TCP', async () => {
    const ws = open(portOf(echo));
    await opened(ws);
    await wait(50);
    const tcpClosed = new Promise<void>((r) =>
      tcpSockets[0].once('close', () => r()),
    );
    ws.close();
    await tcpClosed;
  });

  it('cerrar el TCP cierra el WebSocket', async () => {
    const ws = open(portOf(echo));
    await opened(ws);
    await wait(50);
    tcpSockets[0].destroy();
    await closedWs(ws);
  });

  it('un WebSocket que se cierra mientras conecta no deja el TCP colgado', async () => {
    const ws = open(portOf(echo));
    ws.once('open', () => ws.terminate());
    await closedWs(ws);
    await wait(150);
    for (const s of tcpSockets)
      expect(s.destroyed || s.readyState === 'closed').toBe(true);
  });

  it('limita las conexiones simultáneas por IP y libera el cupo al cerrar', async () => {
    const socks = [1, 2, 3, 4].map(() => open(portOf(echo)));
    await Promise.all(socks.map(opened));
    await expect(opened(open(portOf(echo)))).rejects.toThrow();
    socks[0].close();
    await closedWs(socks[0]);
    await wait(50);
    const again = open(portOf(echo));
    await opened(again);
    for (const s of [...socks.slice(1), again]) s.close();
  });

  it('un handshake fallido no consume el cupo de la IP', async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((res) => {
        const req = httpRequest({
          port: portOf(http),
          host: '127.0.0.1',
          path: `/game/ws?port=${portOf(echo)}`,
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
            Origin: `http://127.0.0.1:${portOf(http)}`,
          },
        });
        req.on('response', () => res());
        req.on('error', () => res());
        req.on('close', () => res());
        req.end();
      });
    }
    const ws = open(portOf(echo));
    await opened(ws);
    ws.close();
  });

  it('rechaza IPs bloqueadas', async () => {
    blocked.add('127.0.0.1');
    await expect(opened(open(portOf(echo)))).rejects.toThrow();
  });

  it('corta conexiones sin tráfico y mantiene las activas', async () => {
    await bridge.close();
    bridge = attachGameBridge(
      http,
      { ...cfg, idleMs: 200 },
      {
        isBlocked: () => false,
        trustProxy: false,
        log: () => {},
      },
    );
    const idle = open(portOf(echo));
    const busy = open(portOf(echo));
    await Promise.all([opened(idle), opened(busy)]);
    busy.on('message', () => {});
    const timer = setInterval(() => busy.send(Buffer.from([1])), 80);
    await closedWs(idle);
    expect(busy.readyState).toBe(WebSocket.OPEN);
    clearInterval(timer);
    busy.close();
  });
});
