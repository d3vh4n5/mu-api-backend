import { Injectable } from '@nestjs/common';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../../generated/prisma/client.js';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error('❌ DATABASE_URL no está definida en el archivo .env');
    }

    const adapter = new PrismaMssql(url);
    super({ adapter });
  }
}
