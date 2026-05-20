import { z } from 'zod';

export const SourceType = z.enum(['TEXT', 'VOICE', 'IMAGE']);
export type SourceType = z.infer<typeof SourceType>;

export const PrivacyLevel = z.enum(['NORMAL', 'SENSITIVE', 'LOCKED']);
export type PrivacyLevel = z.infer<typeof PrivacyLevel>;

export const ProcessingStatus = z.enum([
  'queued',
  'extracting',
  'embedding',
  'ready',
  'extraction_failed',
  'embedding_failed',
]);
export type ProcessingStatus = z.infer<typeof ProcessingStatus>;

export const CreateEntryInput = z.object({
  raw_text: z.string().min(1).max(10_000),
  source_type: SourceType.default('TEXT'),
  client_timezone: z.string().min(1).max(64),
  user_mood: z.number().int().min(1).max(5).nullish(),
  user_tags: z.array(z.string().min(1).max(64)).max(20).nullish(),
  privacy_level: PrivacyLevel.default('NORMAL'),
  occurred_at: z.string().datetime().nullish(),
});
export type CreateEntryInput = z.infer<typeof CreateEntryInput>;

export const Entry = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  raw_text: z.string(),
  normalized_text: z.string().nullable(),
  source_type: SourceType,
  media_url: z.string().nullable(),
  privacy_level: PrivacyLevel,
  processing_status: ProcessingStatus,
  user_mood: z.number().int().nullable(),
  user_tags: z.array(z.string()).nullable(),
  client_timezone: z.string().nullable(),
  occurred_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type Entry = z.infer<typeof Entry>;
