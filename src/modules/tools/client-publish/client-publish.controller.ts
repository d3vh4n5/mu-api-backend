import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { ClientPublishService } from './client-publish.service';
import { PublishDto } from './dto/publish.dto';

/**
 * Publicación del cliente desde Client Tools (sin Escritorio Remoto).
 * Solo SECRET_API_KEY. Sin rate limit: la primera publicación son miles de
 * archivos, y una key inválida ya bloquea la IP vía IpBlocklistService.
 */
@Controller('tools/client-publish')
@UseGuards(ApiKeyGuard)
@SkipThrottle()
export class ClientPublishController {
  constructor(private readonly service: ClientPublishService) {}

  @Get('state')
  state() {
    return this.service.getState();
  }

  @Post('sessions')
  createSession(@Query('force') force?: string) {
    return this.service.createSession(force === 'true');
  }

  @Delete('sessions/:id')
  async cancelSession(@Param('id') id: string) {
    await this.service.cancelSession(id);
    return { cancelled: id };
  }

  @Put('sessions/:id/files')
  uploadFile(
    @Param('id') id: string,
    @Query('path') path: string,
    @Headers('x-sha256') sha256: string | undefined,
    @Req() req: Request,
  ) {
    if (!sha256 || !/^[0-9a-f]{64}$/i.test(sha256)) {
      throw new BadRequestException('Falta x-sha256 (64 caracteres hex)');
    }
    return this.service.receiveFile(id, path, sha256, req);
  }

  @Post('sessions/:id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishDto) {
    return this.service.publish(id, dto);
  }
}
