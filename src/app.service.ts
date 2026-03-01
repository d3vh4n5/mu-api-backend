import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class AppService implements OnModuleInit {
  onModuleInit() {
    console.log('AppService initialized');
  }

  getHello(): string {
    return 'Hello World!';
  }
}
