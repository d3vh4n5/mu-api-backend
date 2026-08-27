import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ServerResetController } from './server-reset.controller';
import { ServerResetService } from './server-reset.service';

@Module({
  controllers: [ServerResetController],
  providers: [ServerResetService, PrismaService],
})
export class ServerResetModule {}
