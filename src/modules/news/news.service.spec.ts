import { NotFoundException } from '@nestjs/common';
import { NewsService } from './news.service';
import type { CreateNewsDto } from './dto/news.dto';

// El cliente real de Prisma no hace falta: se inyecta un mock en cada test
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

type Row = Record<string, unknown>;
type Args = { data?: Row; where?: Row; skip?: number; take?: number };

const actor = { username: 'admin', ip: '1.2.3.4' };

function row(overrides: Row = {}): Row {
  return {
    Id: 1,
    Title: 'Título',
    Summary: null,
    Content: 'Contenido',
    Category: 'novedad',
    ImageUrl: null,
    Published: true,
    Pinned: false,
    PublishedAt: new Date('2026-11-10T12:00:00Z'),
    CreatedAt: new Date('2026-11-01T12:00:00Z'),
    UpdatedAt: new Date('2026-11-01T12:00:00Z'),
    CreatedBy: 'admin',
    UpdatedBy: null,
    ...overrides,
  };
}

function dto(overrides: Partial<CreateNewsDto> = {}): CreateNewsDto {
  return {
    title: '  Nueva noticia  ',
    content: ' Hola ',
    category: 'novedad',
    published: true,
    pinned: false,
    ...overrides,
  };
}

/** Primer argumento de la llamada n de un mock. */
function argOf(fn: jest.Mock, call = 0): Args {
  return (fn.mock.calls[call] as [Args])[0];
}

function setup() {
  const prisma = {
    news: {
      count: jest.fn(() => Promise.resolve(0)),
      findMany: jest.fn<Promise<Row[]>, [Args]>(() => Promise.resolve([])),
      findFirst: jest.fn<Promise<Row | null>, [Args]>(() =>
        Promise.resolve(null),
      ),
      findUnique: jest.fn<Promise<Row | null>, [Args]>(() =>
        Promise.resolve(null),
      ),
      create: jest.fn((args: Args) =>
        Promise.resolve(row({ ...args.data, Id: 7 })),
      ),
      update: jest.fn((args: Args) => Promise.resolve(row({ ...args.data }))),
      delete: jest.fn(() => Promise.resolve({})),
    },
    adminAuditLog: {
      create: jest.fn<Promise<object>, [Args]>(() => Promise.resolve({})),
    },
  };
  const service = new NewsService(prisma as never);
  return { prisma, service };
}

describe('NewsService', () => {
  it('al publicar sin fecha usa el momento actual y recorta espacios', async () => {
    const { prisma, service } = setup();
    const before = Date.now();
    await service.create(actor, dto());
    const data = argOf(prisma.news.create).data!;
    expect(data.Title).toBe('Nueva noticia');
    expect(data.Content).toBe('Hola');
    expect(data.CreatedBy).toBe('admin');
    expect((data.PublishedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('un borrador no tiene fecha de publicación', async () => {
    const { prisma, service } = setup();
    await service.create(actor, dto({ published: false }));
    expect(argOf(prisma.news.create).data!.PublishedAt).toBeNull();
  });

  it('respeta la fecha indicada (programar una publicación)', async () => {
    const { prisma, service } = setup();
    await service.create(actor, dto({ publishedAt: '2030-01-01T10:00:00Z' }));
    expect(argOf(prisma.news.create).data!.PublishedAt).toEqual(
      new Date('2030-01-01T10:00:00Z'),
    );
  });

  it('despublicar y volver a publicar conserva la fecha original', async () => {
    const { prisma, service } = setup();
    const original = new Date('2026-11-10T12:00:00Z');
    prisma.news.findUnique.mockResolvedValue(
      row({ Published: false, PublishedAt: original }),
    );
    await service.update(actor, 1, dto({ published: true }));
    const data = argOf(prisma.news.update).data!;
    expect(data.PublishedAt).toEqual(original);
    expect(data.UpdatedBy).toBe('admin');
  });

  it('las escrituras quedan auditadas como news.*', async () => {
    const { prisma, service } = setup();
    await service.create(actor, dto());
    prisma.news.findUnique.mockResolvedValue(row({ Id: 7 }));
    await service.remove(actor, 7);
    const audit = prisma.adminAuditLog.create;
    expect(argOf(audit, 0).data!.Action).toBe('news.create');
    expect(argOf(audit, 1).data!.Action).toBe('news.delete');
    expect(argOf(audit, 0).data!.TargetType).toBe('news');
  });

  it('el público solo ve publicadas con fecha cumplida', async () => {
    const { prisma, service } = setup();
    await service.listPublic(2, 5);
    const args = argOf(prisma.news.findMany);
    expect(args.where!.Published).toBe(true);
    expect((args.where!.PublishedAt as { lte: unknown }).lte).toBeInstanceOf(
      Date,
    );
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
  });

  it('una noticia no visible da 404', async () => {
    const { service } = setup();
    await expect(service.getPublic(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sin resumen, lo arma con el contenido sin Markdown', async () => {
    const { prisma, service } = setup();
    prisma.news.findFirst.mockResolvedValue(
      row({
        Content:
          '# Evento\n**Castle Siege** el [sábado](https://x.y) ' +
          'a'.repeat(300),
      }),
    );
    const news = await service.getPublic(1);
    expect(news.summary.startsWith('Evento Castle Siege el sábado')).toBe(true);
    expect(news.summary.endsWith('…')).toBe(true);
    expect(news.summary.length).toBeLessThanOrEqual(181);
  });

  it('el launcher recibe links a la web y se cachea hasta la próxima edición', async () => {
    process.env.FRONTEND_URL = 'https://web.example/';
    const { prisma, service } = setup();
    prisma.news.findMany.mockResolvedValue([
      {
        Id: 3,
        Title: 'Hola',
        Category: 'evento',
        Pinned: true,
        PublishedAt: new Date('2026-11-10T12:00:00Z'),
      },
    ]);
    const first = (await service.listForLauncher(5)) as {
      newsUrl: string;
      items: { url: string }[];
    };
    expect(first.newsUrl).toBe('https://web.example/news');
    expect(first.items[0].url).toBe('https://web.example/news/3');

    await service.listForLauncher(5);
    expect(prisma.news.findMany).toHaveBeenCalledTimes(1);

    await service.create(actor, dto());
    await service.listForLauncher(5);
    expect(prisma.news.findMany).toHaveBeenCalledTimes(2);
  });
});
