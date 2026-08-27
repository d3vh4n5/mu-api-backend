import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('players')
@UseGuards(ApiKeyGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get('online')
  findAllOnline() {
    return this.playersService.findAllOnline();
  }

  @Post(':name/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  makeCharacterAdmin(@Param('name') name: string) {
    return this.playersService.makeCharacterAdmin(name);
  }

  @Post(':name/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  banCharacter(@Param('name') name: string) {
    return this.playersService.banCharacter(name);
  }

  @Post(':name/normalize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  normalizeCharacter(@Param('name') name: string) {
    return this.playersService.normalizeCharacter(name);
  }

  @Post('account/:username/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  banAccount(@Param('username') username: string) {
    return this.playersService.banAccount(username);
  }

  @Post('account/:username/normalize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  normalizeAccount(@Param('username') username: string) {
    return this.playersService.normalizeAccount(username);
  }
}
