import { BadRequestException } from '@nestjs/common';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  clientDir,
  isLauncherExe,
  normalizeRelPath,
  resolveInside,
  scanClientFiles,
  stagingRoot,
} from './client-files';

const SHA_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('normalizeRelPath', () => {
  it('pasa barras invertidas a /', () => {
    expect(normalizeRelPath('Data\\Local\\Text_Spn.bmd')).toBe(
      'Data/Local/Text_Spn.bmd',
    );
  });

  it('deja intactos acentos y espacios', () => {
    expect(normalizeRelPath('Data/Música/a b.mp3')).toBe('Data/Música/a b.mp3');
  });

  it.each(['', '../x', 'Data/../../x', '/etc/x', '\\x', 'C:/x', 'Data/a:b'])(
    'rechaza %p',
    (rel) => {
      expect(() => normalizeRelPath(rel)).toThrow(BadRequestException);
    },
  );
});

describe('resolveInside / isLauncherExe', () => {
  it('resuelve dentro de la carpeta base', () => {
    expect(resolveInside('/base', 'Data/x.bmd')).toMatch(
      /[\\/]base[\\/]Data[\\/]x\.bmd$/,
    );
  });

  it('reconoce launcher.exe sin importar mayúsculas', () => {
    expect(isLauncherExe('Launcher.EXE')).toBe(true);
    expect(isLauncherExe('Data/Launcher/updater.exe')).toBe(false);
  });
});

describe('carpetas y escaneo', () => {
  let publicDir: string;

  beforeEach(async () => {
    publicDir = await mkdtemp(join(tmpdir(), 'client-files-'));
    process.env.PUBLIC_DIR = publicDir;
  });

  afterEach(async () => {
    delete process.env.PUBLIC_DIR;
    await rm(publicDir, { recursive: true, force: true });
  });

  it('el staging queda fuera de downloads', () => {
    expect(stagingRoot()).toBe(join(publicDir, 'client-publish-staging'));
    expect(clientDir()).toBe(
      join(publicDir, 'downloads', 'Mu99bClassic', 'Client'),
    );
  });

  it('lista los archivos reales con sha256, ordenados', async () => {
    await mkdir(join(clientDir(), 'Data'), { recursive: true });
    await writeFile(join(clientDir(), 'main.exe'), 'abc');
    await writeFile(join(clientDir(), 'Data', 'x.bmd'), 'zz');

    const files = await scanClientFiles();

    expect(files.map((f) => f.path)).toEqual(['Data/x.bmd', 'main.exe']);
    expect(files[1]).toEqual({ path: 'main.exe', size: 3, sha256: SHA_ABC });
  });

  it('sin carpeta Client devuelve []', async () => {
    expect(await scanClientFiles()).toEqual([]);
  });
});
