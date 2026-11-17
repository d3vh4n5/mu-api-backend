import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { serverDataAllowed, setupGameStatic } from './setup-game-static';

@Module({})
class EmptyModule {}

describe('serverDataAllowed', () => {
  it('solo terreno, Item.txt y MonsterList.txt', () => {
    expect(serverDataAllowed('Terrain/Terrain1.att')).toBe(true);
    expect(serverDataAllowed('terrain/TERRAIN1.ATT')).toBe(true);
    expect(serverDataAllowed('Item/Item.txt')).toBe(true);
    expect(serverDataAllowed('Monster/MonsterList.txt')).toBe(true);
    expect(serverDataAllowed('Terrain/../Item/Item.txt')).toBe(false);
    expect(serverDataAllowed('GameServerInfo.dat')).toBe(false);
    expect(serverDataAllowed('Terrain/x.txt')).toBe(false);
    expect(serverDataAllowed('Shop/Shop0.txt')).toBe(false);
  });
});

describe('setupGameStatic', () => {
  let root: string;
  let app: NestExpressApplication;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'game-static-'));
    const page = join(root, 'jugar');
    const client = join(root, 'client');
    const server = join(root, 'server');
    for (const d of [
      page,
      join(client, 'Logo'),
      join(server, 'Item'),
      join(server, 'Shop'),
    ])
      mkdirSync(d, { recursive: true });
    writeFileSync(join(page, 'index.html'), '<!doctype html><title>MU</title>');
    writeFileSync(join(client, 'Logo', 'x.OZJ'), Buffer.from([1, 2, 3]));
    writeFileSync(join(server, 'Item', 'Item.txt'), 'items');
    writeFileSync(join(server, 'Shop', 'Shop0.txt'), 'secreto');

    app = await NestFactory.create<NestExpressApplication>(EmptyModule, {
      logger: false,
    });
    setupGameStatic(app, { page, clientData: client, serverData: server });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('sirve la página del juego con una CSP que permite WebGL y el WebSocket', async () => {
    const res = await request(app.getHttpServer()).get('/jugar/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>MU</title>');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).toContain("img-src 'self' blob: data:");
    // Sin SSL en el VPS: no puede obligar al navegador a pasar a https.
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('sirve la Data del cliente sin clave y con caché', async () => {
    const res = await request(app.getHttpServer()).get(
      '/game/data/client/Logo/x.OZJ',
    );
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/max-age=\d+/);
  });

  it('del server solo sirve los archivos permitidos', async () => {
    const ok = await request(app.getHttpServer()).get(
      '/game/data/server/Item/Item.txt',
    );
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('items');
    const no = await request(app.getHttpServer()).get(
      '/game/data/server/Shop/Shop0.txt',
    );
    expect(no.status).toBe(404);
    const up = await request(app.getHttpServer()).get(
      '/game/data/server/Item/..%2F..%2Fjugar/index.html',
    );
    expect(up.status).toBe(404);
  });

  it('es solo lectura', async () => {
    const res = await request(app.getHttpServer()).post(
      '/game/data/client/Logo/x.OZJ',
    );
    expect(res.status).toBe(404);
  });
});
