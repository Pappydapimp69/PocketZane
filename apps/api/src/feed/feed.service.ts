import { Injectable } from '@nestjs/common';
import type { FeedItem, FeedResponse, Entry, Insight, Extraction } from '@signal/shared';
import { SupabaseService } from '../supabase/supabase.service';

const ENTRY_RECENCY_HALF_LIFE_HOURS = 36;
const INSIGHT_RECENCY_HALF_LIFE_HOURS = 96;

@Injectable()
export class FeedService {
  constructor(private readonly supabase: SupabaseService) {}

  async build(userId: string, limit = 40): Promise<FeedResponse> {
    const admin = this.supabase.admin();

    const [entriesRes, insightsRes] = await Promise.all([
      admin
        .from('entries')
        .select('*, extractions(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit * 2),
      admin
        .from('insights')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'dismissed')
        .order('generated_at', { ascending: false })
        .limit(limit),
    ]);

    if (entriesRes.error) throw new Error(entriesRes.error.message);
    if (insightsRes.error) throw new Error(insightsRes.error.message);

    const now = Date.now();
    const items: FeedItem[] = [];

    for (const row of entriesRes.data ?? []) {
      const { extractions, ...entry } = row as Record<string, unknown> & {
        extractions?: Extraction[] | Extraction;
      };
      const extraction = Array.isArray(extractions) ? extractions[0] ?? null : extractions ?? null;
      const occurredAt = new Date((entry as Entry).created_at);
      items.push({
        type: 'ENTRY',
        id: (entry as Entry).id,
        score: scoreEntry(occurredAt, now, extraction as Extraction | null),
        occurred_at: occurredAt.toISOString(),
        entry: entry as unknown as Entry,
        extraction: (extraction as Extraction) ?? null,
      });
    }

    for (const insight of (insightsRes.data ?? []) as Insight[]) {
      const occurredAt = new Date(insight.generated_at);
      items.push({
        type: 'INSIGHT',
        id: insight.id,
        score: scoreInsight(occurredAt, now, insight),
        occurred_at: occurredAt.toISOString(),
        insight,
      });
    }

    items.sort((a, b) => b.score - a.score);

    return {
      items: items.slice(0, limit),
      next_cursor: null,
    };
  }
}

function scoreEntry(occurredAt: Date, now: number, extraction: Extraction | null): number {
  const recency = recencyScore(occurredAt.getTime(), now, ENTRY_RECENCY_HALF_LIFE_HOURS);
  const significance = extraction ? Math.min(1, extraction.confidence ?? 0) : 0.3;
  // Entries are baseline; insights should usually outrank fresh entries.
  return recency * 0.7 + significance * 0.2;
}

function scoreInsight(occurredAt: Date, now: number, insight: Insight): number {
  const recency = recencyScore(occurredAt.getTime(), now, INSIGHT_RECENCY_HALF_LIFE_HOURS);
  const confidence = insight.confidence;
  const savedBoost = insight.status === 'saved' ? 0.2 : 0;
  return recency * 0.5 + confidence * 0.6 + savedBoost;
}

function recencyScore(occurredAtMs: number, nowMs: number, halfLifeHours: number): number {
  const ageHours = Math.max(0, (nowMs - occurredAtMs) / 3_600_000);
  return Math.pow(0.5, ageHours / halfLifeHours);
}
