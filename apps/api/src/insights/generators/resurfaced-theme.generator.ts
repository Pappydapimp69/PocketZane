import { Injectable } from '@nestjs/common';
import type { InsightCandidate } from '@signal/shared';
import type { Generator, GeneratorContext } from './generator.types';
import { daysBetween, flattenThemes, normalizeLabel, uniqueEntryIds } from './util';

const DORMANCY_DAYS = 30;

/**
 * Resurfaced theme: a theme present in the trigger that also appeared in
 * history, was absent for ≥30 days, and is now back. Surface the gap.
 */
@Injectable()
export class ResurfacedThemeGenerator implements Generator {
  readonly name = 'resurfaced_theme';

  generate(ctx: GeneratorContext): InsightCandidate[] {
    const triggerLabels = new Set(
      (ctx.trigger.extraction?.themes ?? [])
        .filter((t) => t.confidence >= 0.5)
        .map((t) => normalizeLabel(t.label)),
    );
    if (triggerLabels.size === 0) return [];

    const triggerAt = new Date(ctx.trigger.entry.created_at);
    const historyThemes = flattenThemes(ctx.history);

    const candidates: InsightCandidate[] = [];

    for (const label of triggerLabels) {
      const priorOccurrences = historyThemes
        .filter((t) => t.label === label)
        .sort(
          (a, b) =>
            new Date(b.entry.entry.created_at).getTime() -
            new Date(a.entry.entry.created_at).getTime(),
        );
      if (priorOccurrences.length < 2) continue;

      const lastSeen = new Date(priorOccurrences[0]!.entry.entry.created_at);
      const gap = daysBetween(triggerAt, lastSeen);
      if (gap < DORMANCY_DAYS) continue;

      const evidence = uniqueEntryIds([ctx.trigger, ...priorOccurrences.map((o) => o.entry)]);
      const insightConfidence = Math.min(0.9, 0.6 + Math.min(0.3, gap / 365));
      if (insightConfidence < ctx.confidenceThreshold) continue;

      candidates.push({
        insight_type: 'resurfaced_theme',
        title: `"${label}" is back after ${Math.round(gap)} days`,
        body: `You wrote about "${label}" repeatedly until roughly ${Math.round(gap)} days ago, then it disappeared. Today it surfaced again. Worth asking what changed — both when it left and when it returned.`,
        confidence: round(insightConfidence),
        evidence_entry_ids: evidence.slice(0, 8),
        dedup_key: `resurface:${label}:${lastSeen.toISOString().slice(0, 10)}`,
      });
    }

    return candidates;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
