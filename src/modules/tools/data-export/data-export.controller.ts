import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataExportService } from './data-export.service';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';

@Controller('data-export')
@UseGuards(ApiKeyGuard)
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Get()
  findAll() {
    return this.dataExportService.export();
  }
}
