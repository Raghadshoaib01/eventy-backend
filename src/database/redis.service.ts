import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis(
      this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );
    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // Token blacklist helpers
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`bl:${token}`, '1', ttlSeconds);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.exists(`bl:${token}`);
  }

  // OTP helpers
  async saveOtp(
    userId: string,
    otp: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.set(`otp:${userId}`, otp, ttlSeconds);
  }

  async getOtp(userId: string): Promise<string | null> {
    return this.get(`otp:${userId}`);
  }

  async deleteOtp(userId: string): Promise<void> {
    await this.del(`otp:${userId}`);
  }
}
