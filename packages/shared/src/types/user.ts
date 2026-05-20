import { z } from 'zod';

export const UserSettings = z.object({
  tone_preference: z.enum(['neutral', 'gentle', 'direct']).default('neutral'),
  sensitivity_threshold: z.number().min(0).max(1).default(0.5),
  suppressed_themes: z.array(z.string()).default([]),
  amplified_themes: z.array(z.string()).default([]),
  insight_type_weights: z.record(z.string(), z.number()).default({}),
  node_weights: z.record(z.string(), z.number()).default({}),
});
export type UserSettings = z.infer<typeof UserSettings>;

export const UserProfile = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  timezone: z.string(),
  onboarding_complete: z.boolean(),
  settings: UserSettings,
  created_at: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfile>;
