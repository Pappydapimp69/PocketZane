import { Injectable } from '@nestjs/common';
import type { InsightCandidate } from '@signal/shared';
import type { Generator, GeneratorContext } from './generator.types';

/**
 * Contradiction: when the LLM extraction itself flagged contradictions on the
 * trigger entry, surface them as candidates. Cross-entry contradictions
 * (claim now vs. claim a month ago) need vector search and are deferred.
 */
@Injectable()
export class ContradictionGenerator implements Generator {
  readonly name = 'contradiction';

  generate(ctx: GeneratorContext): InsightCandidate[] {
    const contradictions = ctx.trigger.extraction?.contradictions ?? [];
    if (contradictions.length === 0) return [];

    const candidates: InsightCandidate[] = [];
    for (const c of contradictions) {
      if (c.confidence < ctx.confidenceThreshold) continue;
      candidates.push({
        insight_type: 'contradiction',
        title: 'Two things you said that pull in different directions',
        body: `In the same entry you wrote: "${c.claim}" — and also implied: "${c.tension}". The conflict may be the most useful thing here.`,
        confidence: round(c.confidence),
        evidence_entry_ids: [ctx.trigger.entry.id],
        dedup_key: `contradiction:${ctx.trigger.entry.id}:${hash(c.claim)}`,
      });
    }
    return candidates;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
