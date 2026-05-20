import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { MemoryService } from '../memory/memory.service';
import { InsightsService } from './insights.service';
import { RecurrenceGenerator } from './generators/recurrence.generator';
import { TemporalPatternGenerator } from './generators/temporal-pattern.generator';
import { EmotionalShiftGenerator } from './generators/emotional-shift.generator';
import { ResurfacedThemeGenerator } from './generators/resurfaced-theme.generator';
import { ContradictionGenerator } from './generators/contradiction.generator';
import { REDIS_CONNECTION, INSIGHT_QUEUE, type InsightJobData } from '../queue/queue.tokens';
import type { Generator } from './generators/generator.types';
import type { AppConfig } from '../config/configuration';
import { FeedbackService } from '../feedback/feedback.service';

@Injectable()
export class InsightsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InsightsProcessor.name);
  private worker?: Worker<InsightJobData>;
  private readonly generators: Generator[];

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    private readonly memory: MemoryService,
    private readonly insights: InsightsService,
    private readonly feedback: FeedbackService,
    private readonly config: ConfigService<AppConfig, true>,
    recurrence: RecurrenceGenerator,
    temporal: TemporalPatternGenerator,
    shift: EmotionalShiftGenerator,
    resurface: ResurfacedThemeGenerator,
    contradiction: ContradictionGenerator,
  ) {
    this.generators = [recurrence, temporal, shift, resurface, contradiction];
  }

  onModuleInit(): void {
    this.worker = new Worker<InsightJobData>(
      INSIGHT_QUEUE,
      async (job) => this.handle(job.data),
      { connection: this.redis, concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`maybe-generate-insight failed (${job?.id}): ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle({ entry_id, user_id }: InsightJobData): Promise<void> {
    const trigger = await this.memory.getEntryWithExtraction(user_id, entry_id);
    if (!trigger || !trigger.extraction) {
      this.logger.warn(`Skipping insight job for ${entry_id}: no extraction`);
      return;
    }
    if (trigger.entry.privacy_level === 'LOCKED') return;

    const history = await this.memory.recentEntriesWithExtractions(user_id, 200);
    const historyWithoutTrigger = history.filter((h) => h.entry.id !== entry_id);

    const baseThreshold = this.config.get('INSIGHT_CONFIDENCE_THRESHOLD', { infer: true });
    const minSupporting = this.config.get('INSIGHT_MIN_SUPPORTING_ENTRIES', { infer: true });
    const weights = await this.feedback.loadInsightTypeWeights(user_id);

    const ctx = {
      trigger,
      history: historyWithoutTrigger,
      confidenceThreshold: baseThreshold,
      minSupportingEntries: minSupporting,
      now: new Date(),
    };

    const surviving: ReturnType<Generator['generate']> = [];
    for (const gen of this.generators) {
      const w = weights[gen.name] ?? 1;
      // Skip generators the user has effectively muted.
      if (w <= 0.1) continue;
      const candidates = gen.generate(ctx);
      // Apply user preference as a multiplicative bump/discount.
      for (const c of candidates) {
        const adjusted = clamp(c.confidence * w, 0, 0.99);
        if (adjusted < baseThreshold) continue;
        surviving.push({ ...c, confidence: adjusted });
      }
    }

    if (surviving.length === 0) return;
    const inserted = await this.insights.persistCandidates(user_id, surviving);
    this.logger.log(
      `Generated ${surviving.length} candidates (${inserted} new) for entry ${entry_id}`,
    );
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
