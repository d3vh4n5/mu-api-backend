import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../../generated/prisma/client.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Única instancia de PrismaClient de la app (la provee PrismaModule, que es
 * global). No registrarla en `providers` de otros módulos: cada registro crea
 * un cliente y un pool de conexiones nuevo.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error('❌ DATABASE_URL no está definida en el archivo .env');
    }

    const adapter = new PrismaMssql(url);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to the database');
    } catch (error) {
      // No tiramos la app: el health sigue respondiendo y Prisma reintenta
      // la conexión en la próxima query.
      this.logger.error('Database connection error', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
