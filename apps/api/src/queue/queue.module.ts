import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, QueueEvents, type WorkerOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { QUEUE_NAMES, REDIS_CONNECTION, EXTRACT_QUEUE, EMBED_QUEUE, INSIGHT_QUEUE } from './queue.tokens';
import type { AppConfig } from '../config/configuration';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): Redis => {
        const url = config.get('REDIS_URL', { infer: true });
        return new IORedis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          tls: url.startsWith('rediss://') ? {} : undefined,
        });
      },
    },
    ...QUEUE_NAMES.map((name) => ({
      provide: queueToken(name),
      inject: [REDIS_CONNECTION],
      useFactory: (connection: Redis): Queue =>
        new Queue(name, {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86400 },
          },
        }),
    })),
  ],
  exports: [REDIS_CONNECTION, ...QUEUE_NAMES.map(queueToken)],
})
export class QueueModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Workers and queues are torn down by their owning modules; the Redis
    // connection is shared and closed here.
  }
}

export function queueToken(name: string): string {
  return `BULL_QUEUE_${name}`;
}

export const EXTRACT_QUEUE_TOKEN = queueToken(EXTRACT_QUEUE);
export const EMBED_QUEUE_TOKEN = queueToken(EMBED_QUEUE);
export const INSIGHT_QUEUE_TOKEN = queueToken(INSIGHT_QUEUE);

export type BuildWorker = (opts: WorkerOptions) => Worker;
export { QueueEvents };
