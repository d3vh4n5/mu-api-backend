import { Module } from '@nestjs/common';
import { ServerResetController } from './server-reset.controller';
import { ServerResetService } from './server-reset.service';

@Module({
  controllers: [ServerResetController],
  providers: [ServerResetService],
})
export class ServerResetModule {}
