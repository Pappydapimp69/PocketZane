import { z } from 'zod';

export const FeedbackType = z.enum([
  'accurate',
  'partially_accurate',
  'wrong',
  'important',
  'uncomfortable',
  'boring',
  'save',
  'dismiss',
  'expand',
  'inaccurate',
]);
export type FeedbackType = z.infer<typeof FeedbackType>;

export const CreateFeedbackInput = z.object({
  feedback_type: FeedbackType,
  feedback_text: z.string().max(2000).nullish(),
});
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackInput>;

export const InsightFeedback = z.object({
  id: z.string().uuid(),
  insight_id: z.string().uuid(),
  user_id: z.string().uuid(),
  feedback_type: FeedbackType,
  feedback_text: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type InsightFeedback = z.infer<typeof InsightFeedback>;
