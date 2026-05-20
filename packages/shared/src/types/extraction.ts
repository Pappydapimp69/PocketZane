import { z } from 'zod';

export const EntityType = z.enum(['PERSON', 'PLACE', 'PROJECT', 'ORG', 'CONCEPT']);
export type EntityType = z.infer<typeof EntityType>;

export const ExtractedEntity = z.object({
  name: z.string().min(1).max(200),
  type: EntityType,
  confidence: z.number().min(0).max(1),
});

export const ExtractedEmotion = z.object({
  label: z.string().min(1).max(64),
  intensity: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
});

export const ExtractedBehavior = z.object({
  label: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
});

export const ExtractedTheme = z.object({
  label: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
});

export const ExtractedSymptom = z.object({
  label: z.string().min(1).max(120),
  body_region: z.string().min(1).max(64).nullable(),
  confidence: z.number().min(0).max(1),
});

export const ExtractedContradiction = z.object({
  claim: z.string().min(1).max(500),
  tension: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

export const ExtractedTemporalRef = z.object({
  text: z.string().min(1).max(200),
  resolved_at: z.string().datetime().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ExtractionResult = z.object({
  summary: z.string().min(1).max(500),
  entities: z.array(ExtractedEntity).default([]),
  emotions: z.array(ExtractedEmotion).default([]),
  behaviors: z.array(ExtractedBehavior).default([]),
  themes: z.array(ExtractedTheme).default([]),
  symptoms: z.array(ExtractedSymptom).default([]),
  contradictions: z.array(ExtractedContradiction).default([]),
  temporal_refs: z.array(ExtractedTemporalRef).default([]),
  confidence: z.number().min(0).max(1),
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;

export const Extraction = z.object({
  id: z.string().uuid(),
  entry_id: z.string().uuid(),
  user_id: z.string().uuid(),
  summary: z.string(),
  confidence: z.number(),
  entities: z.array(ExtractedEntity),
  emotions: z.array(ExtractedEmotion),
  behaviors: z.array(ExtractedBehavior),
  themes: z.array(ExtractedTheme),
  symptoms: z.array(ExtractedSymptom),
  contradictions: z.array(ExtractedContradiction),
  temporal_refs: z.array(ExtractedTemporalRef),
  created_at: z.string().datetime(),
});
export type Extraction = z.infer<typeof Extraction>;
