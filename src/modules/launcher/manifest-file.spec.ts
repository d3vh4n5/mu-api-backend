import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { manifestPath, readPublishedManifest } from './manifest-file';

describe('readPublishedManifest', () => {
  let publicDir: string;

  beforeEach(async () => {
    publicDir = await mkdtemp(join(tmpdir(), 'manifest-'));
    process.env.PUBLIC_DIR = publicDir;
  });

  afterEach(async () => {
    delete process.env.PUBLIC_DIR;
    await rm(publicDir, { recursive: true, force: true });
  });

  async function writeManifest(content: string) {
    await mkdir(dirname(manifestPath()), { recursive: true });
    await writeFile(manifestPath(), content, 'utf-8');
  }

  it('devuelve el manifest del disco', async () => {
    const manifest = {
      version: '1.0.1',
      file_count: 1,
      files: [{ path: 'main.exe', size: 3, sha256: 'abc' }],
    };
    await writeManifest(JSON.stringify(manifest));

    expect(await readPublishedManifest()).toEqual(manifest);
  });

  it('404 si no existe', async () => {
    await expect(readPublishedManifest()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('500 si no es JSON', async () => {
    await writeManifest('{roto');
    await expect(readPublishedManifest()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('500 si files no es array', async () => {
    await writeManifest(JSON.stringify({ version: '1', files: {} }));
    await expect(readPublishedManifest()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
