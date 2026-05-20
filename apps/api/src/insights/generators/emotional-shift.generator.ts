import { Injectable } from '@nestjs/common';
import type { InsightCandidate } from '@signal/shared';
import type { Generator, GeneratorContext } from './generator.types';
import type { EntryWithExtraction } from '../../memory/memory.service';
import { flattenThemes, mean, uniqueEntryIds } from './util';

/**
 * Emotional shift: for a recurring theme, the mean emotion intensity across
 * the most recent half of supporting entries differs from the older half
 * by ≥ 1.0 on the 1-5 scale.
 */
@Injectable()
export class EmotionalShiftGenerator implements Generator {
  readonly name = 'emotional_shift';

  generate(ctx: GeneratorContext): InsightCandidate[] {
    const all = [ctx.trigger, ...ctx.history];
    const themes = flattenThemes(all);
    const byTheme = new Map<string, typeof themes>();
    for (const t of themes) {
      const list = byTheme.get(t.label) ?? [];
      list.push(t);
      byTheme.set(t.label, list);
    }

    const candidates: InsightCandidate[] = [];

    for (const [label, occurrences] of byTheme) {
      if (occurrences.length < Math.max(4, ctx.minSupportingEntries + 1)) continue;

      const sorted = occurrences
        .slice()
        .sort(
          (a, b) =>
            new Date(a.entry.entry.created_at).getTime() -
            new Date(b.entry.entry.created_at).getTime(),
        );
      const mid = Math.floor(sorted.length / 2);
      const older = sorted.slice(0, mid);
      const newer = sorted.slice(mid);

      const olderMean = mean(older.flatMap((o) => intensitiesForEntry(o.entry)));
      const newerMean = mean(newer.flatMap((o) => intensitiesForEntry(o.entry)));
      if (olderMean === null || newerMean === null) continue;

      const delta = newerMean - olderMean;
      if (Math.abs(delta) < 1.0) continue;

      const direction = delta > 0 ? 'intensified' : 'cooled';
      const evidence = uniqueEntryIds(sorted.map((o) => o.entry));
      const insightConfidence = Math.min(0.9, 0.55 + Math.min(1, Math.abs(delta) / 3));
      if (insightConfidence < ctx.confidenceThreshold) continue;

      candidates.push({
        insight_type: 'emotional_shift',
        title: `Your tone around "${label}" has ${direction}`,
        body: `When "${label}" came up in your earlier entries, the emotional intensity averaged ${olderMean.toFixed(1)}/5. In your more recent entries on the same theme it averages ${newerMean.toFixed(1)}/5. The shift may be the story.`,
        confidence: round(insightConfidence),
        evidence_entry_ids: evidence.slice(0, 8),
        dedup_key: `theme-shift:${label}`,
      });
    }

    return candidates;

    function intensitiesForEntry(item: EntryWithExtraction): number[] {
      const emotions = item.extraction?.emotions ?? [];
      return emotions.map((e) => e.intensity);
    }
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
