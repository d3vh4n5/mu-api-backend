import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminActor, writeAdminAudit } from '../../common/audit/admin-audit';
import type { News } from '../../../generated/prisma/client.js';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';

/** Lo que ve el público (web): sin datos internos de quién la cargó. */
export type PublicNews = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  imageUrl: string | null;
  pinned: boolean;
  publishedAt: string;
};

const SUMMARY_FALLBACK_LENGTH = 180;
const LAUNCHER_CACHE_MS = 60_000;

@Injectable()
export class NewsService {
  /** El launcher consulta en cada apertura: se cachea un minuto (se invalida al editar). */
  private launcherCache: { at: number; limit: number; data: unknown } | null =
    null;

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------- públicas

  /** Publicadas y con fecha ya cumplida: fijadas primero, después las más nuevas. */
  private visibleWhere() {
    return { Published: true, PublishedAt: { lte: new Date() } };
  }

  async listPublic(page = 1, limit = 10) {
    const where = this.visibleWhere();
    const [total, rows] = await Promise.all([
      this.prisma.news.count({ where }),
      this.prisma.news.findMany({
        where,
        orderBy: [{ Pinned: 'desc' }, { PublishedAt: 'desc' }, { Id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      items: rows.map((row) => this.toPublic(row)),
    };
  }

  async getPublic(id: number) {
    const row = await this.prisma.news.findFirst({
      where: { Id: id, ...this.visibleWhere() },
    });
    if (!row) throw new NotFoundException('Noticia no encontrada');
    return this.toPublic(row);
  }

  /** Versión mínima para el launcher: título, categoría, fecha y link a la web. */
  async listForLauncher(limit = 5) {
    const cached = this.launcherCache;
    if (
      cached &&
      cached.limit === limit &&
      Date.now() - cached.at < LAUNCHER_CACHE_MS
    ) {
      return cached.data;
    }

    const rows = await this.prisma.news.findMany({
      where: this.visibleWhere(),
      orderBy: [{ Pinned: 'desc' }, { PublishedAt: 'desc' }, { Id: 'desc' }],
      take: limit,
      select: {
        Id: true,
        Title: true,
        Category: true,
        Pinned: true,
        PublishedAt: true,
      },
    });
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const data = {
      newsUrl: frontend ? `${frontend}/news` : null,
      items: rows.map((row) => ({
        id: row.Id,
        title: row.Title,
        category: row.Category,
        pinned: row.Pinned,
        publishedAt: row.PublishedAt?.toISOString() ?? null,
        url: frontend ? `${frontend}/news/${row.Id}` : null,
      })),
    };
    this.launcherCache = { at: Date.now(), limit, data };
    return data;
  }

  // ---------------------------------------------------------------- admin

  async listAdmin() {
    const rows = await this.prisma.news.findMany({
      orderBy: [{ Pinned: 'desc' }, { PublishedAt: 'desc' }, { Id: 'desc' }],
      take: 200,
    });
    return rows.map((row) => this.toAdmin(row));
  }

  async getAdmin(id: number) {
    return this.toAdmin(await this.findOrFail(id));
  }

  async create(actor: AdminActor, dto: CreateNewsDto) {
    const row = await this.prisma.news.create({
      data: {
        ...this.toData(dto, null),
        CreatedBy: actor.username.slice(0, 10),
      },
    });
    await this.audit(actor, 'news.create', row);
    return this.toAdmin(row);
  }

  async update(actor: AdminActor, id: number, dto: UpdateNewsDto) {
    const current = await this.findOrFail(id);
    const row = await this.prisma.news.update({
      where: { Id: id },
      data: {
        ...this.toData(dto, current),
        UpdatedAt: new Date(),
        UpdatedBy: actor.username.slice(0, 10),
      },
    });
    await this.audit(actor, 'news.update', row);
    return this.toAdmin(row);
  }

  async remove(actor: AdminActor, id: number) {
    const current = await this.findOrFail(id);
    await this.prisma.news.delete({ where: { Id: id } });
    await this.audit(actor, 'news.delete', current);
    return { ok: true };
  }

  // -------------------------------------------------------------- helpers

  private async findOrFail(id: number) {
    const row = await this.prisma.news.findUnique({ where: { Id: id } });
    if (!row) throw new NotFoundException('Noticia no encontrada');
    return row;
  }

  /**
   * Fecha de publicación: la indicada; si no hay y se publica, la que ya tenía
   * o ahora. Así, despublicar y volver a publicar no cambia la fecha original.
   */
  private toData(dto: CreateNewsDto, current: News | null) {
    let publishedAt: Date | null = dto.publishedAt
      ? new Date(dto.publishedAt)
      : (current?.PublishedAt ?? null);
    if (dto.published && !publishedAt) publishedAt = new Date();

    // El ValidationPipe no transforma: el recorte de espacios se hace acá
    return {
      Title: dto.title.trim(),
      Summary: dto.summary?.trim() || null,
      Content: dto.content.trim(),
      Category: dto.category,
      ImageUrl: dto.imageUrl?.trim() || null,
      Published: dto.published,
      Pinned: dto.pinned,
      PublishedAt: publishedAt,
    };
  }

  private async audit(actor: AdminActor, action: string, row: News) {
    this.launcherCache = null;
    await writeAdminAudit(this.prisma, actor, {
      action,
      targetType: 'news',
      target: `#${row.Id} ${row.Title}`,
      details: { published: row.Published, pinned: row.Pinned },
    });
  }

  /** Resumen: el cargado, o el inicio del contenido sin marcas de Markdown. */
  private summaryOf(row: News) {
    if (row.Summary) return row.Summary;
    const plain = row.Content.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.length > SUMMARY_FALLBACK_LENGTH
      ? `${plain.slice(0, SUMMARY_FALLBACK_LENGTH).trimEnd()}…`
      : plain;
  }

  private toPublic(row: News): PublicNews {
    return {
      id: row.Id,
      title: row.Title,
      summary: this.summaryOf(row),
      content: row.Content,
      category: row.Category,
      imageUrl: row.ImageUrl,
      pinned: row.Pinned,
      publishedAt: (row.PublishedAt ?? row.CreatedAt).toISOString(),
    };
  }

  private toAdmin(row: News) {
    return {
      id: row.Id,
      title: row.Title,
      summary: row.Summary,
      content: row.Content,
      category: row.Category,
      imageUrl: row.ImageUrl,
      published: row.Published,
      pinned: row.Pinned,
      publishedAt: row.PublishedAt?.toISOString() ?? null,
      visible:
        row.Published && !!row.PublishedAt && row.PublishedAt <= new Date(),
      createdAt: row.CreatedAt.toISOString(),
      createdBy: row.CreatedBy,
      updatedAt: row.UpdatedAt.toISOString(),
      updatedBy: row.UpdatedBy,
    };
  }
}
