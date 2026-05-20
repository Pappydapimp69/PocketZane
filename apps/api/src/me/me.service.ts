import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface ExportPayload {
  exported_at: string;
  user: unknown;
  entries: unknown[];
  extractions: unknown[];
  insights: unknown[];
  insight_feedback: unknown[];
}

@Injectable()
export class MeService {
  constructor(private readonly supabase: SupabaseService) {}

  async exportData(userId: string): Promise<ExportPayload> {
    const admin = this.supabase.admin();
    const [user, entries, extractions, insights, feedback] = await Promise.all([
      admin.from('users').select('*').eq('id', userId).maybeSingle(),
      admin.from('entries').select('*').eq('user_id', userId),
      admin.from('extractions').select('*').eq('user_id', userId),
      admin.from('insights').select('*').eq('user_id', userId),
      admin.from('insight_feedback').select('*').eq('user_id', userId),
    ]);

    return {
      exported_at: new Date().toISOString(),
      user: user.data ?? null,
      entries: entries.data ?? [],
      extractions: extractions.data ?? [],
      insights: insights.data ?? [],
      insight_feedback: feedback.data ?? [],
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    const admin = this.supabase.admin();
    // public.users has ON DELETE CASCADE on auth.users, and every app table
    // cascades from public.users. Deleting the auth user removes everything.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Failed to delete user: ${error.message}`);
  }
}
