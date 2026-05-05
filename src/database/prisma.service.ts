import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // constructor() {
  //   const connectionString = process.env.DATABASE_URL;
  //   const pool = new Pool({ connectionString });
  //   const adapter = new PrismaPg(pool);
  //   super({ adapter, log: ['error', 'warn'] });
  // }
  constructor() {
    super({ log: ['error', 'warn'] });
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
