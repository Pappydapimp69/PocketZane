import { Injectable } from '@nestjs/common';
import type { InsightCandidate } from '@signal/shared';
import type { Generator, GeneratorContext } from './generator.types';
import { flattenThemes, flattenEntities, uniqueEntryIds, normalizeLabel } from './util';

/**
 * Recurrence: a theme or named entity appears in ≥ N supporting entries,
 * including the trigger, within the recent window. Emit a candidate
 * describing the recurrence with evidence_entry_ids populated.
 */
@Injectable()
export class RecurrenceGenerator implements Generator {
  readonly name = 'recurrence';

  generate(ctx: GeneratorContext): InsightCandidate[] {
    const candidates: InsightCandidate[] = [];

    const triggerThemes = new Set(
      (ctx.trigger.extraction?.themes ?? [])
        .filter((t) => t.confidence >= 0.5)
        .map((t) => normalizeLabel(t.label)),
    );
    const triggerEntities = new Set(
      (ctx.trigger.extraction?.entities ?? [])
        .filter((e) => e.confidence >= 0.5 && e.type !== 'CONCEPT')
        .map((e) => normalizeLabel(e.name)),
    );

    const allThemes = flattenThemes([ctx.trigger, ...ctx.history]);
    const allEntities = flattenEntities([ctx.trigger, ...ctx.history]);

    for (const label of triggerThemes) {
      const occurrences = allThemes.filter((t) => t.label === label && t.confidence >= 0.5);
      if (occurrences.length < ctx.minSupportingEntries) continue;

      const evidence = uniqueEntryIds(occurrences.map((o) => o.entry));
      if (evidence.length < ctx.minSupportingEntries) continue;

      const avgConfidence =
        occurrences.reduce((acc, o) => acc + o.confidence, 0) / occurrences.length;
      const insightConfidence = Math.min(0.95, 0.55 + avgConfidence * 0.3);
      if (insightConfidence < ctx.confidenceThreshold) continue;

      candidates.push({
        insight_type: 'recurrence',
        title: `Recurring theme: ${label}`,
        body: `The theme "${label}" appears across ${evidence.length} of your recent entries. It may be worth a closer look at what consistently puts it on your mind.`,
        confidence: round(insightConfidence),
        evidence_entry_ids: evidence.slice(0, 8),
        dedup_key: `theme:${label}`,
      });
    }

    for (const name of triggerEntities) {
      const occurrences = allEntities.filter((e) => e.name === name && e.confidence >= 0.5);
      if (occurrences.length < ctx.minSupportingEntries) continue;
      const evidence = uniqueEntryIds(occurrences.map((o) => o.entry));
      if (evidence.length < ctx.minSupportingEntries) continue;

      const avgConfidence =
        occurrences.reduce((acc, o) => acc + o.confidence, 0) / occurrences.length;
      const insightConfidence = Math.min(0.95, 0.6 + avgConfidence * 0.3);
      if (insightConfidence < ctx.confidenceThreshold) continue;

      candidates.push({
        insight_type: 'recurrence',
        title: `${name} keeps coming up`,
        body: `You've mentioned ${name} across ${evidence.length} recent entries. There may be more weight there than any single mention suggests.`,
        confidence: round(insightConfidence),
        evidence_entry_ids: evidence.slice(0, 8),
        dedup_key: `entity:${name}`,
      });
    }

    return candidates;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
