import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getDownloadsDir } from '../../downloads/setup-downloads';
import { MANIFEST_REL_PATH } from './paths';

export interface ClientManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface ClientManifest {
  version: string;
  file_count: number;
  files: ClientManifestFile[];
}

const logger = new Logger('Manifest');

/** Ruta física del manifest que baja el launcher. */
export function manifestPath(): string {
  return join(getDownloadsDir(), MANIFEST_REL_PATH);
}

/**
 * Lee el manifest publicado en disco. No hay manifest de respaldo: si falta o
 * está roto se responde error, para no tapar un problema real.
 */
export async function readPublishedManifest(): Promise<ClientManifest> {
  const path = manifestPath();

  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn(`No existe ${path}`);
      throw new NotFoundException('manifest.json no publicado');
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return invalid(`no es JSON (${(error as Error).message})`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { files?: unknown }).files)
  ) {
    return invalid('falta "files" o no es una lista');
  }

  return parsed as ClientManifest;
}

function invalid(reason: string): never {
  logger.error(`manifest.json inválido: ${reason}`);
  throw new InternalServerErrorException(`manifest.json inválido: ${reason}`);
}
