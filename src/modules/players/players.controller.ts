import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@Controller('players')
@UseGuards(ApiKeyGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get('online')
  findAllOnline() {
    return this.playersService.findAllOnline();
  }
}
