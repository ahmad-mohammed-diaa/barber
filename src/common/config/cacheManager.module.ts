import { Global, Module } from '@nestjs/common';

import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST,
            port: +process.env.REDIS_PORT,
          },
          password: process.env.REDIS_PASSWORD,
          ttl: 60 * 5, // Cache expiry (5 minutes)
        }),
      }),
    }),
  ],
  controllers: [],
  providers: [],
  exports: [CacheModule],
})
export class Cache {}
