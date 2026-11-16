import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, rename, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { manifestPath } from '../../launcher/manifest-file';
import type { PublishDto } from './dto/publish.dto';
import {
  clientDir,
  isLauncherExe,
  normalizeRelPath,
  resolveInside,
  scanClientFiles,
  stagingRoot,
} from './client-files';

/** Una sesión sin actividad por este tiempo se descarta al crear la siguiente. */
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * En Windows, reemplazar o borrar un archivo que alguien tiene abierto (un
 * launcher bajándolo, el antivirus) falla con estos códigos por un momento.
 */
const RETRYABLE_FS_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const FS_ATTEMPTS = 6;
const FS_RETRY_DELAY_MS = 150;

async function withFsRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!RETRYABLE_FS_CODES.has(code) || attempt >= FS_ATTEMPTS) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, FS_RETRY_DELAY_MS * attempt),
      );
    }
  }
}

interface StagedFile {
  path: string;
  sha256: string;
  size: number;
}

interface Session {
  id: string;
  startedAt: Date;
  lastActivity: number;
  /** Clave: ruta en minúsculas (en Windows "Data/X" y "data/x" son el mismo archivo). */
  files: Map<string, StagedFile>;
  /** Hay un publish aplicándose: no se puede cancelar, reemplazar ni subir. */
  publishing: boolean;
  /** Archivos ya movidos a Client/ (cuenta también los de intentos anteriores). */
  applied: number;
}

/**
 * Publicación del cliente desde Client Tools: los archivos se suben uno por
 * uno a un staging y recién en `publish` se aplican a Client/ junto con el
 * manifest. Así un corte a mitad no cambia nada para los jugadores.
 */
@Injectable()
export class ClientPublishService {
  private readonly logger = new Logger(ClientPublishService.name);
  private session: Session | null = null;

  async getState() {
    return { files: await scanClientFiles() };
  }

  async createSession(force: boolean): Promise<{ sessionId: string }> {
    const current = this.session;
    if (current) {
      this.ensureNotPublishing(current);
      const expired = Date.now() - current.lastActivity > SESSION_TTL_MS;
      if (!force && !expired) {
        throw new ConflictException({
          message: 'Hay otra publicación en curso',
          sessionId: current.id,
          startedAt: current.startedAt.toISOString(),
        });
      }
      this.logger.warn(
        `Se descarta la sesión ${current.id} (${expired ? 'vencida' : 'forzado'})`,
      );
      await this.discard(current.id);
    }

    // Las sesiones viven en memoria: tras un reinicio de la API pueden quedar
    // carpetas de staging huérfanas (hasta el tamaño del cliente cada una).
    await rm(stagingRoot(), { recursive: true, force: true });

    const id = randomUUID();
    await mkdir(this.stagingDir(id), { recursive: true });
    this.session = {
      id,
      startedAt: new Date(),
      lastActivity: Date.now(),
      files: new Map(),
      publishing: false,
      applied: 0,
    };
    this.logger.log(`Sesión de publicación ${id} creada`);
    return { sessionId: id };
  }

  async cancelSession(id: string): Promise<void> {
    this.ensureNotPublishing(this.requireSession(id));
    await this.discard(id);
    this.logger.log(`Sesión de publicación ${id} cancelada`);
  }

  async receiveFile(
    id: string,
    rel: string,
    expectedSha: string,
    body: Readable,
  ): Promise<{ path: string; size: number }> {
    const session = this.requireSession(id);
    this.ensureNotPublishing(session);
    const path = normalizeRelPath(rel);
    const target = resolveInside(this.stagingDir(id), path);
    const partial = `${target}.part`;

    await mkdir(dirname(target), { recursive: true });

    const hash = createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        size += chunk.length;
        callback(null, chunk);
      },
    });

    try {
      await pipeline(body, meter, createWriteStream(partial));
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }

    const sha256 = hash.digest('hex');
    if (sha256 !== expectedSha.toLowerCase()) {
      await rm(partial, { force: true });
      throw new BadRequestException(`sha256 no coincide para ${path}`);
    }

    await rename(partial, target);
    session.files.set(path.toLowerCase(), { path, sha256, size });
    session.lastActivity = Date.now();
    return { path, size };
  }

  /**
   * Valida todo antes de tocar el disco; recién después mueve lo subido a
   * Client/, borra y escribe el manifest (último, para que los launchers no vean
   * la versión nueva hasta que esté completa).
   */
  async publish(
    id: string,
    dto: PublishDto,
  ): Promise<{
    uploaded: number;
    deleted: string[];
    ignored: string[];
    manifestFiles: number;
  }> {
    const session = this.requireSession(id);
    this.ensureNotPublishing(session);
    session.publishing = true;
    try {
      return await this.validateAndApply(session, dto);
    } finally {
      session.publishing = false;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Si falla a mitad de aplicar, el manifest viejo sigue publicado y la sesión
   * conserva solo lo que falta mover: el mismo publish se puede reintentar (lo
   * ya movido se valida contra Client/ como cualquier archivo existente).
   */
  private async validateAndApply(session: Session, dto: PublishDto) {
    const id = session.id;
    const problems: string[] = [];

    const current = new Map(
      (await scanClientFiles()).map((f) => [f.path.toLowerCase(), f]),
    );

    // 1. Borrados
    const toDelete: string[] = [];
    const ignored: string[] = [];
    for (const raw of dto.delete ?? []) {
      const rel = normalizeRelPath(raw);
      if (isLauncherExe(rel)) {
        throw new BadRequestException('launcher.exe no se puede borrar');
      }
      const existing = current.get(rel.toLowerCase());
      if (existing) toDelete.push(existing.path);
      else ignored.push(rel);
    }
    const deleting = new Set(toDelete.map((p) => p.toLowerCase()));

    // 2. Cada archivo del manifest tiene que existir con ese sha al terminar
    const used = new Set<string>();
    for (const file of dto.manifest.files) {
      const rel = normalizeRelPath(file.path);
      const key = rel.toLowerCase();
      if (isLauncherExe(rel)) {
        problems.push(`${rel}: launcher.exe no va en el manifest`);
        continue;
      }
      if (deleting.has(key)) {
        problems.push(`${rel}: está en el manifest y también se borra`);
        continue;
      }
      const sha = file.sha256.toLowerCase();
      const staged = session.files.get(key);
      if (staged) {
        used.add(key);
        if (staged.sha256 !== sha)
          problems.push(`${rel}: sha256 distinto al subido`);
      } else if (current.get(key)?.sha256 !== sha) {
        problems.push(
          `${rel}: no se subió y en el servidor no está con ese sha256`,
        );
      }
    }

    // 3. Extras (launcher.exe): tienen que haberse subido
    for (const raw of dto.extraFiles ?? []) {
      const key = normalizeRelPath(raw).toLowerCase();
      if (session.files.has(key)) used.add(key);
      else problems.push(`${raw}: figura en extraFiles pero no se subió`);
    }

    // 4. Nada subido puede quedar sin destino
    for (const [key, staged] of session.files) {
      if (!used.has(key)) {
        problems.push(`${staged.path}: se subió pero no está en el manifest`);
      }
    }

    if (problems.length) {
      throw new BadRequestException({
        message: 'El manifest no coincide con los archivos',
        problems,
      });
    }

    // Aplicar
    const base = clientDir();
    for (const [key, staged] of [...session.files]) {
      // Si ya existe con otra capitalización, se reemplaza ese mismo archivo
      const existing = current.get(key);
      const target = resolveInside(base, existing?.path ?? staged.path);
      await this.applyStep(staged.path, async () => {
        await mkdir(dirname(target), { recursive: true });
        await withFsRetry(() =>
          rename(resolveInside(this.stagingDir(id), staged.path), target),
        );
      });
      session.files.delete(key);
      session.applied += 1;
    }
    for (const rel of toDelete) {
      await this.applyStep(rel, () =>
        withFsRetry(() => rm(resolveInside(base, rel), { force: true })),
      );
    }

    const manifestFile = manifestPath();
    await this.applyStep('manifest.json', async () => {
      await mkdir(dirname(manifestFile), { recursive: true });
      await writeFile(
        `${manifestFile}.tmp`,
        JSON.stringify(dto.manifest, null, 2),
        'utf-8',
      );
      await withFsRetry(() => rename(`${manifestFile}.tmp`, manifestFile));
    });

    const uploaded = session.applied;
    await this.discard(id);
    this.logger.log(
      `Publicado: ${uploaded} subidos, ${toDelete.length} borrados, manifest con ${dto.manifest.files.length} archivos`,
    );

    return {
      uploaded,
      deleted: toDelete,
      ignored,
      manifestFiles: dto.manifest.files.length,
    };
  }

  /** Error de disco al aplicar → 500 que dice qué archivo falló. */
  private async applyStep(label: string, step: () => Promise<void>) {
    try {
      await step();
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      this.logger.error(`No se pudo aplicar ${label}: ${err.message}`);
      throw new InternalServerErrorException(
        `No se pudo aplicar ${label} (${err.code ?? err.message}). ` +
          'No se publicó el manifest nuevo: reintentá publicar.',
      );
    }
  }

  private ensureNotPublishing(session: Session) {
    if (session.publishing) {
      throw new ConflictException({
        message: 'Se está aplicando una publicación; esperá a que termine',
        sessionId: session.id,
        startedAt: session.startedAt.toISOString(),
      });
    }
  }

  private stagingDir(id: string) {
    return join(stagingRoot(), id);
  }

  private requireSession(id: string): Session {
    if (!this.session || this.session.id !== id) {
      throw new NotFoundException(
        'Sesión de publicación inexistente o vencida',
      );
    }
    return this.session;
  }

  private async discard(id: string) {
    await rm(this.stagingDir(id), { recursive: true, force: true });
    if (this.session?.id === id) this.session = null;
  }
}
