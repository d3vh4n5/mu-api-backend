import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import {
  manifestPath,
  readPublishedManifest,
} from '../../launcher/manifest-file';
import { clientDir, stagingRoot } from './client-files';
import { ClientPublishService } from './client-publish.service';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const body = (text: string) => Readable.from([Buffer.from(text)]);

describe('ClientPublishService (sesiones y subida)', () => {
  let publicDir: string;
  let service: ClientPublishService;

  beforeEach(async () => {
    publicDir = await mkdtemp(join(tmpdir(), 'client-publish-'));
    process.env.PUBLIC_DIR = publicDir;
    service = new ClientPublishService();
  });

  afterEach(async () => {
    jest.useRealTimers();
    delete process.env.PUBLIC_DIR;
    await rm(publicDir, { recursive: true, force: true });
  });

  const staged = (id: string, rel: string) => join(stagingRoot(), id, rel);

  it('receiveFile con sha correcto deja el archivo en staging', async () => {
    const { sessionId } = await service.createSession(false);
    const rel = 'Data/Música/a b.mp3';

    const result = await service.receiveFile(
      sessionId,
      rel,
      sha('abc'),
      body('abc'),
    );

    expect(result).toEqual({ path: rel, size: 3 });
    expect(await readFile(staged(sessionId, rel), 'utf-8')).toBe('abc');
  });

  it('receiveFile con sha incorrecto lo rechaza y no deja el archivo', async () => {
    const { sessionId } = await service.createSession(false);

    await expect(
      service.receiveFile(sessionId, 'main.exe', sha('otro'), body('abc')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(existsSync(staged(sessionId, 'main.exe'))).toBe(false);
  });

  it('receiveFile dos veces el mismo path reemplaza', async () => {
    const { sessionId } = await service.createSession(false);
    await service.receiveFile(sessionId, 'main.exe', sha('abc'), body('abc'));
    await service.receiveFile(sessionId, 'main.exe', sha('xyz'), body('xyz'));

    expect(await readFile(staged(sessionId, 'main.exe'), 'utf-8')).toBe('xyz');
  });

  it('receiveFile con ruta que sale de la carpeta se rechaza', async () => {
    const { sessionId } = await service.createSession(false);
    await expect(
      service.receiveFile(sessionId, '../x', sha('abc'), body('abc')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('receiveFile con sessionId desconocido da 404', async () => {
    await expect(
      service.receiveFile('nope', 'main.exe', sha('abc'), body('abc')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createSession con otra activa da 409; con force la reemplaza', async () => {
    const first = await service.createSession(false);
    await service.receiveFile(
      first.sessionId,
      'a.txt',
      sha('abc'),
      body('abc'),
    );

    await expect(service.createSession(false)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const second = await service.createSession(true);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(existsSync(join(stagingRoot(), first.sessionId))).toBe(false);
  });

  it('createSession reemplaza una sesión vencida (30 min) sin force', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    jest.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    const first = await service.createSession(false);

    jest.setSystemTime(new Date('2026-11-16T10:31:00Z'));
    const second = await service.createSession(false);

    expect(second.sessionId).not.toBe(first.sessionId);
  });

  describe('publish', () => {
    const client = (rel: string) => join(clientDir(), rel);
    const entry = (path: string, text: string) => ({
      path,
      size: text.length,
      sha256: sha(text),
    });
    const manifestOf = (...files: ReturnType<typeof entry>[]) => ({
      version: '1.0.1',
      file_count: files.length,
      files,
    });

    async function putClient(rel: string, text: string) {
      await mkdir(dirname(client(rel)), { recursive: true });
      await writeFile(client(rel), text);
    }

    async function putManifest(content: object) {
      await mkdir(dirname(manifestPath()), { recursive: true });
      await writeFile(manifestPath(), JSON.stringify(content));
    }

    it('aplica archivos, borra y escribe el manifest', async () => {
      await putClient('old.bmd', 'viejo');
      const { sessionId } = await service.createSession(false);
      await service.receiveFile(sessionId, 'main.exe', sha('abc'), body('abc'));
      const manifest = manifestOf(entry('main.exe', 'abc'));

      const result = await service.publish(sessionId, {
        manifest,
        delete: ['old.bmd'],
        extraFiles: [],
      });

      expect(result).toEqual({
        uploaded: 1,
        deleted: ['old.bmd'],
        ignored: [],
        manifestFiles: 1,
      });
      expect(await readFile(client('main.exe'), 'utf-8')).toBe('abc');
      expect(existsSync(client('old.bmd'))).toBe(false);
      expect(await readPublishedManifest()).toEqual(manifest);
      expect(existsSync(join(stagingRoot(), sessionId))).toBe(false);
    });

    it('rechaza un archivo del manifest que también se borra, sin tocar nada', async () => {
      await putClient('a.bmd', 'aaa');
      const previous = manifestOf(entry('a.bmd', 'aaa'));
      await putManifest(previous);
      const { sessionId } = await service.createSession(false);

      await expect(
        service.publish(sessionId, {
          manifest: manifestOf(entry('a.bmd', 'aaa')),
          delete: ['A.bmd'],
          extraFiles: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(existsSync(client('a.bmd'))).toBe(true);
      expect(await readPublishedManifest()).toEqual(previous);
    });

    it('rechaza un sha del manifest que no está ni en staging ni en Client', async () => {
      const { sessionId } = await service.createSession(false);

      const error = await service
        .publish(sessionId, {
          manifest: manifestOf(entry('Data/x.bmd', 'nada')),
          delete: [],
          extraFiles: [],
        })
        .catch((e: BadRequestException) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(
        JSON.stringify((error as BadRequestException).getResponse()),
      ).toContain('Data/x.bmd');
    });

    it('rechaza borrar launcher.exe', async () => {
      await putClient('launcher.exe', 'L');
      const { sessionId } = await service.createSession(false);

      await expect(
        service.publish(sessionId, {
          manifest: manifestOf(),
          delete: ['Launcher.exe'],
          extraFiles: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(existsSync(client('launcher.exe'))).toBe(true);
    });

    it('launcher.exe en extraFiles se copia y no va al manifest', async () => {
      const { sessionId } = await service.createSession(false);
      await service.receiveFile(
        sessionId,
        'launcher.exe',
        sha('L2'),
        body('L2'),
      );

      await service.publish(sessionId, {
        manifest: manifestOf(),
        delete: [],
        extraFiles: ['launcher.exe'],
      });

      expect(await readFile(client('launcher.exe'), 'utf-8')).toBe('L2');
      expect((await readPublishedManifest()).files).toEqual([]);
    });

    it('rechaza launcher.exe dentro del manifest', async () => {
      const { sessionId } = await service.createSession(false);
      await service.receiveFile(
        sessionId,
        'launcher.exe',
        sha('L2'),
        body('L2'),
      );

      await expect(
        service.publish(sessionId, {
          manifest: manifestOf(entry('launcher.exe', 'L2')),
          delete: [],
          extraFiles: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta un archivo existente en Client con distinta capitalización', async () => {
      await putClient('Data/X.bmd', 'xx');
      const { sessionId } = await service.createSession(false);

      const result = await service.publish(sessionId, {
        manifest: manifestOf(entry('data/x.bmd', 'xx')),
        delete: [],
        extraFiles: [],
      });

      expect(result.manifestFiles).toBe(1);
    });

    it('ignora borrados de archivos que no existen', async () => {
      const { sessionId } = await service.createSession(false);

      const result = await service.publish(sessionId, {
        manifest: manifestOf(),
        delete: ['nada.bmd'],
        extraFiles: [],
      });

      expect(result.ignored).toEqual(['nada.bmd']);
      expect(result.deleted).toEqual([]);
    });

    it('rechaza archivos subidos que no están ni en el manifest ni en extraFiles', async () => {
      const { sessionId } = await service.createSession(false);
      await service.receiveFile(sessionId, 'suelto.txt', sha('s'), body('s'));

      await expect(
        service.publish(sessionId, {
          manifest: manifestOf(),
          delete: [],
          extraFiles: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(existsSync(client('suelto.txt'))).toBe(false);
    });
  });

  it('cancelSession borra el staging y libera la sesión', async () => {
    const { sessionId } = await service.createSession(false);
    await service.receiveFile(sessionId, 'a.txt', sha('abc'), body('abc'));

    await service.cancelSession(sessionId);

    expect(existsSync(join(stagingRoot(), sessionId))).toBe(false);
    await expect(service.createSession(false)).resolves.toBeDefined();
  });
});
