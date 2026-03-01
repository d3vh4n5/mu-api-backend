import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());
  const prismaService = new PrismaService();
  await prismaService
    .$connect()
    .then(() => Logger.log('Connected to the database'))
    .catch((error) => Logger.error('Database connection error', error));
  await app.listen(process.env.PORT ?? 3000, () => {
    Logger.log(
      `Server is running on http://localhost:${process.env.PORT ?? 3000}`,
    );
  });
}
bootstrap();
