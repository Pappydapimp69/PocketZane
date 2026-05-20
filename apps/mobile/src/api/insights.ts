import type { CreateFeedbackInput, Insight, InsightFeedback } from '@signal/shared';
import { apiFetch } from './client';

export async function getInsight(id: string): Promise<Insight> {
  return apiFetch<Insight>(`/insights/${id}`);
}

export async function submitFeedback(
  insightId: string,
  input: CreateFeedbackInput,
): Promise<InsightFeedback> {
  return apiFetch<InsightFeedback>(`/insights/${insightId}/feedback`, {
    method: 'POST',
    json: input,
  });
}
