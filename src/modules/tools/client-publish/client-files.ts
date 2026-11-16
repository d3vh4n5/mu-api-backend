import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, resolve, sep } from 'path';
import {
  getDownloadsDir,
  getPublicDir,
} from '../../../downloads/setup-downloads';
import { CLIENT_REL_DIR } from '../../launcher/paths';

export interface ClientFileEntry {
  /** Relativa a Client/, con "/" */
  path: string;
  size: number;
  sha256: string;
}

/** Carpeta del cliente que baja el launcher. */
export function clientDir(): string {
  return join(getDownloadsDir(), CLIENT_REL_DIR);
}

/** Donde esperan los archivos subidos hasta publicar. Fuera de downloads: nunca se sirve. */
export function stagingRoot(): string {
  return join(getPublicDir(), 'client-publish-staging');
}

/** Ruta relativa con "/", validada para que no pueda salir de la carpeta base. */
export function normalizeRelPath(rel: string): string {
  const normalized = (rel ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part !== '' && part !== '.')
    .join('/');

  const invalid =
    normalized === '' ||
    /^[\\/]/.test(rel) ||
    rel.includes(':') ||
    normalized.split('/').includes('..');

  if (invalid) {
    throw new BadRequestException(`Ruta inválida: ${rel}`);
  }
  return normalized;
}

/** Resuelve `rel` dentro de `baseDir`; rechaza cualquier cosa que quede afuera. */
export function resolveInside(baseDir: string, rel: string): string {
  const base = resolve(baseDir);
  const full = resolve(base, normalizeRelPath(rel));
  if (!full.toLowerCase().startsWith((base + sep).toLowerCase())) {
    throw new BadRequestException(`Ruta inválida: ${rel}`);
  }
  return full;
}

/** launcher.exe de la raíz: se publica aparte y nunca se borra. */
export function isLauncherExe(rel: string): boolean {
  return normalizeRelPath(rel).toLowerCase() === 'launcher.exe';
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolveHash(hash.digest('hex')))
      .on('error', reject);
  });
}

// Caché por tamaño + fecha de modificación (mismo criterio que published-file.ts):
// recalcular el sha de todo el cliente en cada consulta tarda varios segundos.
const shaCache = new Map<
  string,
  { size: number; mtimeMs: number; sha256: string }
>();

async function walk(dir: string, prefix: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walk(join(dir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

/** Archivos que hay hoy en Client/ (lo que realmente baja el launcher). */
export async function scanClientFiles(): Promise<ClientFileEntry[]> {
  const base = clientDir();
  const paths: string[] = [];
  try {
    await walk(base, '', paths);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files: ClientFileEntry[] = [];
  for (const rel of paths.sort()) {
    const full = join(base, rel);
    const st = await stat(full);
    const cached = shaCache.get(full);
    let sha256: string;
    if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs) {
      sha256 = cached.sha256;
    } else {
      sha256 = await sha256File(full);
      shaCache.set(full, { size: st.size, mtimeMs: st.mtimeMs, sha256 });
    }
    files.push({ path: rel, size: st.size, sha256 });
  }
  return files;
}
