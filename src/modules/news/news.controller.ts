import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { AdminActor } from '../../common/audit/admin-audit';
import { NewsService } from './news.service';
import { CreateNewsDto, NewsListQueryDto, UpdateNewsDto } from './dto/news.dto';

/** Noticias publicadas, para la web (vía el BFF de Astro, con API key). */
@Controller('news')
@UseGuards(ApiKeyGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  list(@Query() query: NewsListQueryDto) {
    // El ValidationPipe global valida pero no transforma: llegan como texto
    return this.newsService.listPublic(
      Number(query.page ?? 1),
      Number(query.limit ?? 10),
    );
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.newsService.getPublic(id);
  }
}

type AdminRequest = {
  user?: { username?: unknown };
  headers: Record<string, string | string[] | undefined>;
};

/** ABM de noticias del panel admin. Toda escritura queda auditada. */
@Controller('admin/news')
@UseGuards(ApiKeyGuard, JwtAuthGuard, AdminGuard)
export class AdminNewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  list() {
    return this.newsService.listAdmin();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.newsService.getAdmin(id);
  }

  @Post()
  create(@Req() req: AdminRequest, @Body() dto: CreateNewsDto) {
    return this.newsService.create(this.actor(req), dto);
  }

  @Put(':id')
  update(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNewsDto,
  ) {
    return this.newsService.update(this.actor(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    return this.newsService.remove(this.actor(req), id);
  }

  private actor(req: AdminRequest): AdminActor {
    const username = req.user?.username;
    if (typeof username !== 'string' || !username) {
      throw new UnauthorizedException('Token sin usuario');
    }
    // La web (proxy de Astro, autenticado con API key) informa la IP real del cliente
    const ip = req.headers['x-client-ip'];
    return { username, ip: Array.isArray(ip) ? ip[0] : ip };
  }
}
