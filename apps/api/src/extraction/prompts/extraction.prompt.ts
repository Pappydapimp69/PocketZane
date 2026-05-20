/**
 * Extraction prompt for Signal.
 *
 * The prompt is the product. Iterate aggressively.
 *
 * Goals:
 * - Extract concrete entities (named people/places/projects), not generic categories.
 * - Surface latent contradictions and behavioral patterns the user might miss.
 * - Refuse to invent emotions/symptoms the text does not actually support.
 * - Output strict JSON only, conforming to the schema below.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are Signal, an extraction engine for a private journaling app.

Your job: read one short personal entry and emit a structured JSON object that captures
the *specific* signal in it — named entities, emotions, themes, behaviors, symptoms,
contradictions, and temporal references.

Rules:
1. Be concrete. Prefer specific names ("Maya", "the Tuesday standup") over generic
   categories ("a friend", "a meeting"). Only emit a category when no specific is given.
2. Do NOT invent emotions, symptoms, or contradictions that aren't supported by the text.
   It is better to return an empty list than to fabricate.
3. Confidence scores reflect how clearly the text supports each item.
   - 0.9+ = explicitly stated
   - 0.7-0.9 = strongly implied
   - 0.5-0.7 = inferred but defensible
   - <0.5 = do not emit
4. Emotions take intensity 1-5. 1 = barely present. 5 = dominant in the entry.
5. Contradictions are internal tensions in the entry (e.g. "I love this job but dread Mondays"),
   not contradictions with previous entries — the system handles those separately.
6. Temporal references should resolve to ISO timestamps when unambiguous relative to "now".
7. Output JSON ONLY. No markdown fences, no commentary, no preamble.`;

export function buildExtractionUserPrompt(text: string): string {
  return `Entry text:
"""
${text}
"""

Return a single JSON object matching this schema:

{
  "summary": "1-2 sentence neutral summary",
  "entities": [{"name": string, "type": "PERSON|PLACE|PROJECT|ORG|CONCEPT", "confidence": number}],
  "emotions": [{"label": string, "intensity": 1-5, "confidence": number}],
  "behaviors": [{"label": string, "confidence": number}],
  "themes": [{"label": string, "confidence": number}],
  "symptoms": [{"label": string, "body_region": string|null, "confidence": number}],
  "contradictions": [{"claim": string, "tension": string, "confidence": number}],
  "temporal_refs": [{"text": string, "resolved_at": string|null, "confidence": number}],
  "confidence": number
}`;
}

/** JSON schema for Gemma 4 / Gemini structured output. */
export const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['PERSON', 'PLACE', 'PROJECT', 'ORG', 'CONCEPT'] },
          confidence: { type: 'number' },
        },
        required: ['name', 'type', 'confidence'],
      },
    },
    emotions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          intensity: { type: 'integer' },
          confidence: { type: 'number' },
        },
        required: ['label', 'intensity', 'confidence'],
      },
    },
    behaviors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['label', 'confidence'],
      },
    },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['label', 'confidence'],
      },
    },
    symptoms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          body_region: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
        required: ['label', 'body_region', 'confidence'],
      },
    },
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          tension: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['claim', 'tension', 'confidence'],
      },
    },
    temporal_refs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          resolved_at: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
        required: ['text', 'resolved_at', 'confidence'],
      },
    },
    confidence: { type: 'number' },
  },
  required: ['summary', 'confidence'],
} as const;
