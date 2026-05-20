import type { Entry, Extraction, ExtractionResult } from '@signal/shared';
import type { EntryWithExtraction } from '../../../memory/memory.service';

let id = 0;
function uuid(): string {
  id += 1;
  return `00000000-0000-0000-0000-${id.toString().padStart(12, '0')}`;
}

export function makeEntry(opts: { id?: string; created_at?: string } = {}): Entry {
  return {
    id: opts.id ?? uuid(),
    user_id: '00000000-0000-0000-0000-aaaaaaaaaaaa',
    raw_text: 'sample',
    normalized_text: null,
    source_type: 'TEXT',
    media_url: null,
    privacy_level: 'NORMAL',
    processing_status: 'ready',
    user_mood: null,
    user_tags: null,
    client_timezone: 'UTC',
    occurred_at: null,
    created_at: opts.created_at ?? new Date().toISOString(),
  };
}

export function makeExtraction(
  entry_id: string,
  partial: Partial<ExtractionResult> = {},
): Extraction {
  return {
    id: uuid(),
    entry_id,
    user_id: '00000000-0000-0000-0000-aaaaaaaaaaaa',
    summary: partial.summary ?? '',
    confidence: partial.confidence ?? 0.9,
    entities: partial.entities ?? [],
    emotions: partial.emotions ?? [],
    behaviors: partial.behaviors ?? [],
    themes: partial.themes ?? [],
    symptoms: partial.symptoms ?? [],
    contradictions: partial.contradictions ?? [],
    temporal_refs: partial.temporal_refs ?? [],
    created_at: new Date().toISOString(),
  };
}

export function makeItem(
  themes: string[],
  emotions: { label: string; intensity: number }[] = [],
  createdAt = new Date().toISOString(),
): EntryWithExtraction {
  const entry = makeEntry({ created_at: createdAt });
  const extraction = makeExtraction(entry.id, {
    themes: themes.map((label) => ({ label, confidence: 0.9 })),
    emotions: emotions.map((e) => ({ label: e.label, intensity: e.intensity, confidence: 0.9 })),
  });
  return { entry, extraction };
}
