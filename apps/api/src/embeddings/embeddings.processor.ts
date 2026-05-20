import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { LLM_PROVIDER } from '../llm/llm.tokens';
import type { LlmProvider } from '../llm/providers/provider.interface';
import { REDIS_CONNECTION, EMBED_QUEUE, type EmbedJobData } from '../queue/queue.tokens';

@Injectable()
export class EmbeddingsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingsProcessor.name);
  private worker?: Worker<EmbedJobData>;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<EmbedJobData>(
      EMBED_QUEUE,
      async (job) => this.handle(job.data),
      {
        connection: this.redis,
        concurrency: 8,
        limiter: { max: 60, duration: 60_000 },
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`embed-entry failed (${job?.id}): ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle({ entry_id, user_id }: EmbedJobData): Promise<void> {
    const admin = this.supabase.admin();

    const { data: entry, error } = await admin
      .from('entries')
      .select('id, raw_text')
      .eq('id', entry_id)
      .eq('user_id', user_id)
      .single();
    if (error || !entry) throw new Error(`Entry ${entry_id} not found: ${error?.message}`);

    let embedding: number[];
    try {
      embedding = await this.llm.embed(entry.raw_text);
    } catch (err) {
      await admin
        .from('entries')
        .update({ processing_status: 'embedding_failed' })
        .eq('id', entry_id);
      throw err;
    }

    const { error: upsertErr } = await admin
      .from('entry_embeddings')
      .upsert(
        {
          entry_id,
          user_id,
          // pgvector accepts the JSON array literal.
          embedding: embedding as unknown as string,
          model: this.llm.embeddingModel,
        },
        { onConflict: 'entry_id' },
      );

    if (upsertErr) throw new Error(`Failed to upsert embedding: ${upsertErr.message}`);

    await admin.from('entries').update({ processing_status: 'ready' }).eq('id', entry_id);
  }
}
