import { Injectable } from '@nestjs/common';
import type { Entry, Extraction } from '@signal/shared';
import { SupabaseService } from '../supabase/supabase.service';

export interface EntryWithExtraction {
  entry: Entry;
  extraction: Extraction | null;
}

export interface SimilarEntry {
  entry_id: string;
  similarity: number;
  created_at: string;
}

@Injectable()
export class MemoryService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Top-k semantically similar prior entries for a given embedding. */
  async findSimilar(
    userId: string,
    queryEmbedding: number[],
    opts: { matchCount?: number; minSimilarity?: number; excludeEntryId?: string } = {},
  ): Promise<SimilarEntry[]> {
    const { data, error } = await this.supabase.admin().rpc('match_entries', {
      p_user_id: userId,
      p_query_embedding: queryEmbedding as unknown as string,
      p_match_count: opts.matchCount ?? 10,
      p_min_similarity: opts.minSimilarity ?? 0.55,
      p_exclude_entry_id: opts.excludeEntryId ?? null,
      p_include_locked: false,
    });
    if (error) throw new Error(`match_entries failed: ${error.message}`);
    return (data ?? []) as SimilarEntry[];
  }

  /** Recent (entry, extraction) pairs ordered newest-first. */
  async recentEntriesWithExtractions(
    userId: string,
    limit = 200,
  ): Promise<EntryWithExtraction[]> {
    const { data, error } = await this.supabase
      .admin()
      .from('entries')
      .select('*, extractions(*)')
      .eq('user_id', userId)
      .neq('privacy_level', 'LOCKED')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: Record<string, unknown>): EntryWithExtraction => {
      const { extractions, ...entry } = row as Record<string, unknown> & {
        extractions?: Extraction[] | Extraction;
      };
      const extraction = Array.isArray(extractions) ? extractions[0] ?? null : extractions ?? null;
      return {
        entry: entry as unknown as Entry,
        extraction: (extraction as Extraction) ?? null,
      };
    });
  }

  async getEntryWithExtraction(userId: string, entryId: string): Promise<EntryWithExtraction | null> {
    const { data, error } = await this.supabase
      .admin()
      .from('entries')
      .select('*, extractions(*)')
      .eq('user_id', userId)
      .eq('id', entryId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const { extractions, ...entry } = data as Record<string, unknown> & {
      extractions?: Extraction[] | Extraction;
    };
    const extraction = Array.isArray(extractions) ? extractions[0] ?? null : extractions ?? null;
    return {
      entry: entry as unknown as Entry,
      extraction: (extraction as Extraction) ?? null,
    };
  }
}
