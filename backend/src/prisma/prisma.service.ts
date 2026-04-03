import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(private readonly config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (typeof connectionString !== 'string' || !connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Add it to .env or environment.',
      );
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }
}