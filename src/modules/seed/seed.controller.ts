import { Controller, Get } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Get()
  executeSeed() {
    const env = process.env.NODE_ENV;
    if (!env || env !== 'development')
      throw new Error('Seed can only be executed in development mode');
    return this.seedService.execute();
  }
}
