import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { loadConfig } from './config/configuration';
import { SupabaseModule } from './supabase/supabase.module';
import { LlmModule } from './llm/llm.module';
import { QueueModule } from './queue/queue.module';
import { MemoryModule } from './memory/memory.module';
import { EntriesModule } from './entries/entries.module';
import { ExtractionModule } from './extraction/extraction.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { InsightsModule } from './insights/insights.module';
import { FeedbackModule } from './feedback/feedback.module';
import { FeedModule } from './feed/feed.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadConfig(),
    }),
    SupabaseModule,
    QueueModule,
    LlmModule,
    MemoryModule,
    EntriesModule,
    ExtractionModule,
    EmbeddingsModule,
    InsightsModule,
    FeedbackModule,
    FeedModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
