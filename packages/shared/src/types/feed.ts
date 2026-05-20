import { z } from 'zod';
import { Entry } from './entry';
import { Insight } from './insight';
import { Extraction } from './extraction';

export const FeedItemType = z.enum(['ENTRY', 'INSIGHT']);
export type FeedItemType = z.infer<typeof FeedItemType>;

export const FeedEntryItem = z.object({
  type: z.literal('ENTRY'),
  id: z.string().uuid(),
  score: z.number(),
  occurred_at: z.string().datetime(),
  entry: Entry,
  extraction: Extraction.nullable(),
});

export const FeedInsightItem = z.object({
  type: z.literal('INSIGHT'),
  id: z.string().uuid(),
  score: z.number(),
  occurred_at: z.string().datetime(),
  insight: Insight,
});

export const FeedItem = z.discriminatedUnion('type', [FeedEntryItem, FeedInsightItem]);
export type FeedItem = z.infer<typeof FeedItem>;

export const FeedResponse = z.object({
  items: z.array(FeedItem),
  next_cursor: z.string().nullable(),
});
export type FeedResponse = z.infer<typeof FeedResponse>;
