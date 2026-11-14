import { Module } from '@nestjs/common';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';

@Module({
  controllers: [DataExportController],
  providers: [DataExportService],
})
export class DataExportModule {}
