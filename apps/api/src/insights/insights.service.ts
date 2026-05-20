import { Injectable, NotFoundException } from '@nestjs/common';
import type { Insight, InsightCandidate } from '@signal/shared';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class InsightsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listForUser(userId: string, limit = 50): Promise<Insight[]> {
    const { data, error } = await this.supabase
      .admin()
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('generated_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as Insight[];
  }

  async getById(userId: string, insightId: string): Promise<Insight> {
    const { data, error } = await this.supabase
      .admin()
      .from('insights')
      .select('*')
      .eq('user_id', userId)
      .eq('id', insightId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Insight not found');
    return data as Insight;
  }

  /** Insert all surviving candidates, skipping (user, type, dedup_key) duplicates. */
  async persistCandidates(userId: string, candidates: InsightCandidate[]): Promise<number> {
    if (candidates.length === 0) return 0;
    const rows = candidates.map((c) => ({
      user_id: userId,
      insight_type: c.insight_type,
      title: c.title,
      body: c.body,
      confidence: c.confidence,
      evidence_entry_ids: c.evidence_entry_ids,
      dedup_key: c.dedup_key,
      status: 'active',
    }));
    const { data, error } = await this.supabase
      .admin()
      .from('insights')
      .upsert(rows, {
        onConflict: 'user_id,insight_type,dedup_key',
        ignoreDuplicates: true,
      })
      .select('id');
    if (error) throw new Error(`persistCandidates: ${error.message}`);
    return data?.length ?? 0;
  }

  async updateStatus(userId: string, insightId: string, status: Insight['status']): Promise<void> {
    const { error } = await this.supabase
      .admin()
      .from('insights')
      .update({ status })
      .eq('user_id', userId)
      .eq('id', insightId);
    if (error) throw new Error(error.message);
  }
}
