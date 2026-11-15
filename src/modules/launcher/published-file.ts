import { readFile, stat } from 'fs/promises';
import { Logger } from '@nestjs/common';
import { readPeFileVersion } from './pe-version';

export interface PublishedFileInfo {
  path: string;
  size: number;
  mtimeMs: number;
  /** FileVersion del exe, o null si no tiene metadatos de versión */
  version: string | null;
}

const logger = new Logger('PublishedFile');
const cache = new Map<string, PublishedFileInfo>();

/**
 * Lee los datos de un archivo publicado en /downloads. Se cachea por tamaño y
 * fecha de modificación: al subir un exe nuevo se relee solo, sin reiniciar la API.
 * Devuelve null si el archivo no existe.
 */
export async function getPublishedFileInfo(
  path: string,
): Promise<PublishedFileInfo | null> {
  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(path);
  } catch {
    return null;
  }

  const cached = cache.get(path);
  if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs) {
    return cached;
  }

  const buf = await readFile(path);
  const info: PublishedFileInfo = {
    path,
    size: st.size,
    mtimeMs: st.mtimeMs,
    version: readPeFileVersion(buf),
  };
  cache.set(path, info);
  logger.log(`Leído ${path}: version=${info.version}, size=${info.size}`);
  return info;
}
