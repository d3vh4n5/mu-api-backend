import { Injectable } from '@nestjs/common';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { getDownloadsDir } from '../../downloads/setup-downloads';
import { manifest as embeddedManifest } from '../launcher/data/manifest';
import {
  CLIENT_REL_DIR,
  LAUNCHER_REL_PATH,
  MANIFEST_REL_PATH,
  UPDATER_REL_PATH,
} from '../launcher/paths';
import { getPublishedFileInfo } from '../launcher/published-file';

type ManifestFile = { path: string; size: number; sha256?: string };
type Manifest = { version?: string; files: ManifestFile[] };

/** Cuántos archivos con problemas se listan como máximo (el total siempre se informa). */
const MAX_LISTED = 50;

/**
 * Estado de lo publicado para el launcher, para la pestaña "Actualizaciones"
 * del panel admin. Solo lectura.
 */
@Injectable()
export class UpdatesService {
  async status() {
    const downloadsDir = getDownloadsDir();
    const [launcher, updater, manifest] = await Promise.all([
      this.fileStatus(downloadsDir, LAUNCHER_REL_PATH),
      this.fileStatus(downloadsDir, UPDATER_REL_PATH),
      this.manifestStatus(downloadsDir),
    ]);

    return {
      launcher,
      updater,
      manifest,
      allowDowngrade: process.env.LAUNCHER_ALLOW_DOWNGRADE === 'true',
      checkedAt: new Date().toISOString(),
    };
  }

  private async fileStatus(downloadsDir: string, relPath: string) {
    const info = await getPublishedFileInfo(join(downloadsDir, relPath));
    if (!info) return { path: relPath, exists: false as const };
    return {
      path: relPath,
      exists: true as const,
      version: info.version,
      size: info.size,
      sha256: info.sha256,
      modifiedAt: new Date(info.mtimeMs).toISOString(),
    };
  }

  /**
   * El manifest de disco tiene prioridad (lo sirve /downloads); si no está, el
   * launcher recibe el embebido en la API. Para cada archivo se comprueba que
   * exista en Client/ con el tamaño declarado: si falta, el launcher lo saltea;
   * si el tamaño no coincide, lo vuelve a bajar en cada verificación.
   */
  private async manifestStatus(downloadsDir: string) {
    const diskPath = join(downloadsDir, MANIFEST_REL_PATH);
    let source: 'disk' | 'embedded' = 'embedded';
    let modifiedAt: string | null = null;
    let data: Manifest = embeddedManifest as Manifest;
    let error: string | null = null;

    try {
      const st = await stat(diskPath);
      source = 'disk';
      modifiedAt = st.mtime.toISOString();
      data = JSON.parse(await readFile(diskPath, 'utf8')) as Manifest;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        error = `No se pudo leer ${MANIFEST_REL_PATH}: ${(e as Error).message}`;
        data = { files: [] };
      }
    }

    const files = Array.isArray(data.files) ? data.files : [];
    const clientDir = join(downloadsDir, CLIENT_REL_DIR);
    const checks = await Promise.all(
      files.map(async (file) => {
        try {
          const st = await stat(join(clientDir, file.path));
          return st.size === file.size
            ? null
            : {
                path: file.path,
                problem: 'size' as const,
                expected: file.size,
                actual: st.size,
              };
        } catch {
          return {
            path: file.path,
            problem: 'missing' as const,
            expected: file.size,
            actual: null,
          };
        }
      }),
    );
    const problems = checks.filter((c) => c !== null);
    const missing = problems.filter((p) => p.problem === 'missing');
    const sizeMismatch = problems.filter((p) => p.problem === 'size');

    return {
      source,
      path: MANIFEST_REL_PATH,
      modifiedAt,
      error,
      version: data.version ?? null,
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + (Number(f.size) || 0), 0),
      missingCount: missing.length,
      sizeMismatchCount: sizeMismatch.length,
      problems: problems.slice(0, MAX_LISTED),
    };
  }
}
