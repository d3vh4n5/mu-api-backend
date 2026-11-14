import { Global, Module } from '@nestjs/common';
import { IpBlocklistService } from './ip-blocklist.service';

@Global()
@Module({
  providers: [IpBlocklistService],
  exports: [IpBlocklistService],
})
export class SecurityModule {}
