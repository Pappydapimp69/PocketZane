import type { EntryWithExtraction } from '../../memory/memory.service';

export function normalizeLabel(s: string): string {
  return s.trim().toLowerCase();
}

export function uniqueEntryIds(entries: EntryWithExtraction[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    if (!seen.has(e.entry.id)) {
      seen.add(e.entry.id);
      out.push(e.entry.id);
    }
  }
  return out;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export interface ThemeOccurrence {
  label: string;
  entry: EntryWithExtraction;
  confidence: number;
}

/** Flatten themes across history with their owning entry. */
export function flattenThemes(history: EntryWithExtraction[]): ThemeOccurrence[] {
  const out: ThemeOccurrence[] = [];
  for (const item of history) {
    const themes = item.extraction?.themes ?? [];
    for (const t of themes) {
      out.push({ label: normalizeLabel(t.label), entry: item, confidence: t.confidence });
    }
  }
  return out;
}

export interface EntityOccurrence {
  name: string;
  type: string;
  entry: EntryWithExtraction;
  confidence: number;
}

export function flattenEntities(history: EntryWithExtraction[]): EntityOccurrence[] {
  const out: EntityOccurrence[] = [];
  for (const item of history) {
    const entities = item.extraction?.entities ?? [];
    for (const e of entities) {
      out.push({
        name: normalizeLabel(e.name),
        type: e.type,
        entry: item,
        confidence: e.confidence,
      });
    }
  }
  return out;
}

/** Mean of a numeric array, or null if empty. */
export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
