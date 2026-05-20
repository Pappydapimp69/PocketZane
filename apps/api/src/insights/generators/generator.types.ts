import type { InsightCandidate } from '@signal/shared';
import type { EntryWithExtraction } from '../../memory/memory.service';

export interface GeneratorContext {
  /** The entry that triggered this run, with its extraction. */
  trigger: EntryWithExtraction;
  /** Recent history, newest first, excluding LOCKED entries. */
  history: EntryWithExtraction[];
  /** Minimum confidence for a candidate to be emitted. */
  confidenceThreshold: number;
  /** Minimum supporting entries before any pattern claim is allowed. */
  minSupportingEntries: number;
  /** Current time (injectable for tests). */
  now: Date;
}

export interface Generator {
  readonly name: string;
  generate(ctx: GeneratorContext): InsightCandidate[];
}
