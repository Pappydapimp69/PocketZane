import { Injectable } from '@nestjs/common';
import type { InsightCandidate } from '@signal/shared';
import type { Generator, GeneratorContext } from './generator.types';
import { flattenThemes, uniqueEntryIds } from './util';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Temporal patterns: when a theme appears disproportionately on a specific
 * day of week or time of day, surface that pattern.
 *
 * Heuristic for V1 (no statistics library): a theme with ≥ N occurrences
 * where ≥60% fall on a single day-of-week is worth surfacing.
 */
@Injectable()
export class TemporalPatternGenerator implements Generator {
  readonly name = 'temporal_pattern';

  generate(ctx: GeneratorContext): InsightCandidate[] {
    const themes = flattenThemes([ctx.trigger, ...ctx.history]);
    const byTheme = new Map<string, { dow: number[]; entries: typeof themes }>();

    for (const t of themes) {
      const created = new Date(t.entry.entry.created_at);
      const bucket = byTheme.get(t.label) ?? { dow: [], entries: [] };
      bucket.dow.push(created.getDay());
      bucket.entries.push(t);
      byTheme.set(t.label, bucket);
    }

    const candidates: InsightCandidate[] = [];
    for (const [label, bucket] of byTheme) {
      if (bucket.entries.length < ctx.minSupportingEntries) continue;
      const counts = new Array(7).fill(0) as number[];
      for (const d of bucket.dow) counts[d]! += 1;

      const total = bucket.dow.length;
      let topDay = 0;
      let topCount = 0;
      for (let i = 0; i < 7; i += 1) {
        if (counts[i]! > topCount) {
          topCount = counts[i]!;
          topDay = i;
        }
      }

      const dominance = topCount / total;
      if (dominance < 0.6) continue;
      if (topCount < ctx.minSupportingEntries) continue;

      const evidence = uniqueEntryIds(
        bucket.entries
          .filter((e) => new Date(e.entry.entry.created_at).getDay() === topDay)
          .map((e) => e.entry),
      );

      const insightConfidence = Math.min(0.95, 0.55 + dominance * 0.35);
      if (insightConfidence < ctx.confidenceThreshold) continue;

      candidates.push({
        insight_type: 'temporal_pattern',
        title: `"${label}" tends to show up on ${DAY_NAMES[topDay]}s`,
        body: `Across your entries, "${label}" appears on ${DAY_NAMES[topDay]}s ${topCount}/${total} times. The pattern may be coincidence, or it may point to something specific about how that day sets up the rest of your week.`,
        confidence: round(insightConfidence),
        evidence_entry_ids: evidence.slice(0, 8),
        dedup_key: `theme-dow:${label}:${topDay}`,
      });
    }

    return candidates;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
