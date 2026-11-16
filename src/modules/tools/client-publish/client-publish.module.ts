import { Module } from '@nestjs/common';
import { ClientPublishController } from './client-publish.controller';
import { ClientPublishService } from './client-publish.service';

@Module({
  controllers: [ClientPublishController],
  providers: [ClientPublishService],
})
export class ClientPublishModule {}
