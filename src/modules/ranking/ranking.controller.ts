import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@Controller('ranking')
@UseGuards(ApiKeyGuard)
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  findAll() {
    return this.rankingService.getRanking();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rankingService.findOne(+id);
  }
}
