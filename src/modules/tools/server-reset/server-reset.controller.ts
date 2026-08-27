import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { ServerResetDto } from './dto/server-reset.dto';
import { ServerResetService } from './server-reset.service';

@Controller('tools/server-reset')
@UseGuards(ApiKeyGuard)
export class ServerResetController {
  constructor(private readonly serverResetService: ServerResetService) {}

  @Post()
  reset(@Body() dto: ServerResetDto = new ServerResetDto()) {
    return 'command disabled';
    return this.serverResetService.reset(dto);
  }
}
