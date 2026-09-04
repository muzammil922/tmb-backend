import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private memory = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        this.client.connect().catch(() => {
          this.logger.warn('Redis unavailable, using in-memory cache');
          this.client = null;
        });
      } catch {
        this.logger.warn('Redis init failed, using in-memory cache');
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client) {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    }
    const item = this.memory.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(item.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.client) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.memory.delete(key);
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
