import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rename, rm } from 'fs/promises';

// rename de fs/promises no se puede espiar con spyOn: se reemplaza el módulo y,
// por defecto, delega en el rename real.
jest.mock('fs/promises', () => {
  const actual =
    jest.requireActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, rename: jest.fn(actual.rename) };
});
const realRename =
  jest.requireActual<typeof import('fs/promises')>('fs/promises').rename;
const mockedRename = rename as jest.MockedFunction<typeof rename>;
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { readPublishedManifest } from '../../launcher/manifest-file';
import { clientDir, stagingRoot } from './client-files';
import { ClientPublishService } from './client-publish.service';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const body = (text: string) => Readable.from([Buffer.from(text)]);
const entry = (path: string, text: string) => ({
  path,
  size: text.length,
  sha256: sha(text),
});

function errnoError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe('ClientPublishService (fallas al aplicar)', () => {
  let publicDir: string;
  let service: ClientPublishService;

  beforeEach(async () => {
    publicDir = await mkdtemp(join(tmpdir(), 'client-publish-rb-'));
    process.env.PUBLIC_DIR = publicDir;
    service = new ClientPublishService();
  });

  afterEach(async () => {
    mockedRename.mockImplementation(realRename);
    delete process.env.PUBLIC_DIR;
    await rm(publicDir, { recursive: true, force: true });
  });

  async function sessionWith(files: Record<string, string>) {
    const { sessionId } = await service.createSession(false);
    for (const [rel, text] of Object.entries(files)) {
      await service.receiveFile(sessionId, rel, sha(text), body(text));
    }
    return sessionId;
  }

  const dto = (...files: ReturnType<typeof entry>[]) => ({
    manifest: { version: '1.0.1', file_count: files.length, files },
    delete: [],
    extraFiles: [],
  });

  it('si un archivo queda bloqueado a mitad de aplicar, el publish se puede reintentar', async () => {
    const id = await sessionWith({ 'a.txt': 'aaa', 'b.txt': 'bbb' });
    const payload = dto(entry('a.txt', 'aaa'), entry('b.txt', 'bbb'));

    mockedRename.mockImplementation((from, to) =>
      String(to).endsWith('b.txt')
        ? Promise.reject(errnoError('EPERM'))
        : realRename(from, to),
    );

    const error = await service.publish(id, payload).catch((e: Error) => e);
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as Error).message).toContain('b.txt');
    expect(existsSync(join(clientDir(), 'a.txt'))).toBe(true);

    mockedRename.mockImplementation(realRename);
    const result = await service.publish(id, payload);

    expect(result.manifestFiles).toBe(2);
    expect(await readFile(join(clientDir(), 'b.txt'), 'utf-8')).toBe('bbb');
    expect((await readPublishedManifest()).files).toHaveLength(2);
  });

  it('reintenta el rename cuando el destino está ocupado un momento (EBUSY)', async () => {
    const id = await sessionWith({ 'a.txt': 'aaa' });
    let failures = 0;
    mockedRename.mockImplementation((from, to) => {
      if (String(to).endsWith('a.txt') && failures < 2) {
        failures += 1;
        return Promise.reject(errnoError('EBUSY'));
      }
      return realRename(from, to);
    });

    await service.publish(id, dto(entry('a.txt', 'aaa')));

    expect(failures).toBe(2);
    expect(await readFile(join(clientDir(), 'a.txt'), 'utf-8')).toBe('aaa');
  });

  it('mientras se aplica un publish no se puede cancelar ni forzar otra sesión', async () => {
    const id = await sessionWith({ 'a.txt': 'aaa' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockedRename.mockImplementation(async (from, to) => {
      if (String(to).endsWith('a.txt')) await gate;
      return realRename(from, to);
    });

    const publishing = service.publish(id, dto(entry('a.txt', 'aaa')));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(service.cancelSession(id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.createSession(true)).rejects.toBeInstanceOf(
      ConflictException,
    );

    release();
    await publishing;
    expect(await readFile(join(clientDir(), 'a.txt'), 'utf-8')).toBe('aaa');
  });

  it('crear una sesión borra carpetas de staging huérfanas', async () => {
    const orphan = join(stagingRoot(), 'huerfana-de-un-reinicio');
    await mkdir(orphan, { recursive: true });

    const { sessionId } = await service.createSession(false);

    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(join(stagingRoot(), sessionId))).toBe(true);
  });
});
