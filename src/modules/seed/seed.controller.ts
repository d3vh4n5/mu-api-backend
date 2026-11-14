import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { SeedService } from './seed.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

/**
 * ⚠️ Borra MEMB_INFO, Character y AccountCharacter y carga prisma/seed-data.
 * El módulo solo se registra con NODE_ENV=development (ver app.module.ts);
 * el chequeo de acá es una segunda barrera.
 */
@Controller('seed')
@UseGuards(ApiKeyGuard)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  executeSeed() {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException(
        'Seed can only be executed in development mode',
      );
    }
    return this.seedService.execute();
  }
}
