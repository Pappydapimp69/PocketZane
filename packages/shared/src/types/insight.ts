import { z } from 'zod';

export const InsightType = z.enum([
  'recurrence',
  'contradiction',
  'correlation',
  'temporal_pattern',
  'resurfaced_theme',
  'behavioral_loop',
  'emotional_shift',
  'identity_drift',
]);
export type InsightType = z.infer<typeof InsightType>;

export const InsightStatus = z.enum(['active', 'dismissed', 'saved', 'superseded']);
export type InsightStatus = z.infer<typeof InsightStatus>;

export const Insight = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  insight_type: InsightType,
  title: z.string(),
  body: z.string(),
  confidence: z.number().min(0).max(1),
  evidence_entry_ids: z.array(z.string().uuid()),
  related_node_ids: z.array(z.string().uuid()).default([]),
  status: InsightStatus,
  generated_at: z.string().datetime(),
});
export type Insight = z.infer<typeof Insight>;

export const InsightCandidate = z.object({
  insight_type: InsightType,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  evidence_entry_ids: z.array(z.string().uuid()).min(1),
  dedup_key: z.string().min(1).max(200),
});
export type InsightCandidate = z.infer<typeof InsightCandidate>;
