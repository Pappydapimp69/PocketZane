export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

export const EXTRACT_QUEUE = 'extract-entry';
export const EMBED_QUEUE = 'embed-entry';
export const INSIGHT_QUEUE = 'maybe-generate-insight';

export const QUEUE_NAMES = [EXTRACT_QUEUE, EMBED_QUEUE, INSIGHT_QUEUE] as const;

export interface ExtractJobData {
  entry_id: string;
  user_id: string;
}

export interface EmbedJobData {
  entry_id: string;
  user_id: string;
}

export interface InsightJobData {
  entry_id: string;
  user_id: string;
}
