import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { IpBlocklistService } from './common/security/ip-blocklist.service';
import { setupDownloads } from './downloads/setup-downloads';

/** TRUST_PROXY: "true", número de saltos, o lista ("loopback", "127.0.0.1"). */
function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Solo si hay un reverse proxy delante (Caddy/IIS/nginx); si no, req.ip
  // podría falsificarse con X-Forwarded-For.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
  }

  app.use(helmet());

  const blocklist = app.get(IpBlocklistService);
  app.use(blocklist.middleware());

  // Estáticos del launcher (/downloads), fuera del prefijo /api/v2
  setupDownloads(app, blocklist);

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.setGlobalPrefix('api/v2');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Cierra Prisma prolijamente cuando el servicio de Windows se detiene
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, () => {
    Logger.log(
      `Server is running on http://localhost:${port} (NODE_ENV=${process.env.NODE_ENV})`,
    );
  });
}
void bootstrap();
