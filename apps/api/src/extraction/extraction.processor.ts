import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { LLM_PROVIDER } from '../llm/llm.tokens';
import type { LlmProvider } from '../llm/providers/provider.interface';
import { REDIS_CONNECTION } from '../queue/queue.tokens';
import {
  EMBED_QUEUE_TOKEN,
  INSIGHT_QUEUE_TOKEN,
} from '../queue/queue.module';
import {
  EXTRACT_QUEUE,
  type ExtractJobData,
  type EmbedJobData,
  type InsightJobData,
} from '../queue/queue.tokens';

@Injectable()
export class ExtractionProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExtractionProcessor.name);
  private worker?: Worker<ExtractJobData>;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(EMBED_QUEUE_TOKEN) private readonly embedQueue: Queue<EmbedJobData>,
    @Inject(INSIGHT_QUEUE_TOKEN) private readonly insightQueue: Queue<InsightJobData>,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ExtractJobData>(
      EXTRACT_QUEUE,
      async (job) => this.handle(job.data),
      {
        connection: this.redis,
        concurrency: 4,
        // Gemma free tier ≈ 15 RPM; stay under.
        limiter: { max: 12, duration: 60_000 },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`extract-entry failed (${job?.id}): ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle({ entry_id, user_id }: ExtractJobData): Promise<void> {
    const admin = this.supabase.admin();

    const { data: entry, error } = await admin
      .from('entries')
      .select('id, raw_text, privacy_level')
      .eq('id', entry_id)
      .eq('user_id', user_id)
      .single();

    if (error || !entry) throw new Error(`Entry ${entry_id} not found: ${error?.message}`);

    await admin.from('entries').update({ processing_status: 'extracting' }).eq('id', entry_id);

    let extraction;
    try {
      extraction = await this.llm.extract(entry.raw_text);
    } catch (err) {
      await admin
        .from('entries')
        .update({ processing_status: 'extraction_failed' })
        .eq('id', entry_id);
      throw err;
    }

    const { error: upsertErr } = await admin
      .from('extractions')
      .upsert(
        {
          entry_id,
          user_id,
          summary: extraction.summary,
          confidence: extraction.confidence,
          entities: extraction.entities,
          emotions: extraction.emotions,
          behaviors: extraction.behaviors,
          themes: extraction.themes,
          symptoms: extraction.symptoms,
          contradictions: extraction.contradictions,
          temporal_refs: extraction.temporal_refs,
        },
        { onConflict: 'entry_id' },
      );

    if (upsertErr) throw new Error(`Failed to upsert extraction: ${upsertErr.message}`);

    await admin.from('entries').update({ processing_status: 'embedding' }).eq('id', entry_id);

    await this.embedQueue.add(
      'embed',
      { entry_id, user_id },
      { jobId: `embed:${entry_id}` },
    );
    await this.insightQueue.add(
      'maybe-insight',
      { entry_id, user_id },
      { jobId: `insight:${entry_id}` },
    );
  }
}
