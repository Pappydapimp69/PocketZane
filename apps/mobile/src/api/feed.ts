import type { FeedResponse } from '@signal/shared';
import { apiFetch } from './client';

export async function getFeed(): Promise<FeedResponse> {
  return apiFetch<FeedResponse>('/feed');
}
