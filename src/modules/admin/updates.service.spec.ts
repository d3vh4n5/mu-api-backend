import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { UpdatesService } from './updates.service';

describe('UpdatesService.status (manifest)', () => {
  let publicDir: string;

  beforeEach(async () => {
    publicDir = await mkdtemp(join(tmpdir(), 'updates-'));
    process.env.PUBLIC_DIR = publicDir;
  });

  afterEach(async () => {
    delete process.env.PUBLIC_DIR;
    await rm(publicDir, { recursive: true, force: true });
  });

  it('sin manifest.json informa el error en vez de usar uno embebido', async () => {
    const { manifest } = await new UpdatesService().status();

    expect(manifest.source).toBe('missing');
    expect(manifest.error).toBe('manifest.json no publicado');
    expect(manifest.fileCount).toBe(0);
  });

  it('con manifest.json en disco lo usa', async () => {
    const dir = join(publicDir, 'downloads', 'Mu99bClassic');
    await mkdir(join(dir, 'Client'), { recursive: true });
    await writeFile(join(dir, 'Client', 'main.exe'), 'abc');
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.1',
        files: [{ path: 'main.exe', size: 3, sha256: 'x' }],
      }),
    );

    const { manifest } = await new UpdatesService().status();

    expect(manifest.source).toBe('disk');
    expect(manifest.error).toBeNull();
    expect(manifest.fileCount).toBe(1);
    expect(manifest.missingCount).toBe(0);
  });
});
