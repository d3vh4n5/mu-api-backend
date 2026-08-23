import { Module } from '@nestjs/common';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [DataExportController],
  providers: [DataExportService, PrismaService],
})
export class DataExportModule {}
