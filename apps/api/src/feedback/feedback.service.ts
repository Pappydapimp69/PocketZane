import { Injectable } from '@nestjs/common';
import type { CreateFeedbackInput, InsightFeedback } from '@signal/shared';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Feedback shapes future insight generation in two ways:
 *
 * 1. Per-insight: stored as a row in insight_feedback.
 * 2. Per-user weighting profile: collapsed into users.settings_json so
 *    generators can read it cheaply without aggregating raw feedback rows.
 *
 * V1 weighting is intentionally simple:
 * - `accurate` / `important` → bump insight_type weight by +0.1
 * - `wrong` / `boring` / `dismiss` → drop weight by -0.15
 * - `uncomfortable` → small bump (+0.05) — we want to surface useful pain
 * - weights clamp to [0, 2] so users can mute or amplify, but never invert
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly supabase: SupabaseService) {}

  async submit(
    userId: string,
    insightId: string,
    input: CreateFeedbackInput,
  ): Promise<InsightFeedback> {
    const admin = this.supabase.admin();

    const { data: insight, error: insightErr } = await admin
      .from('insights')
      .select('id, user_id, insight_type, status')
      .eq('id', insightId)
      .eq('user_id', userId)
      .single();
    if (insightErr || !insight) {
      throw new Error(`Insight not found: ${insightErr?.message}`);
    }

    const { data, error } = await admin
      .from('insight_feedback')
      .insert({
        insight_id: insightId,
        user_id: userId,
        feedback_type: input.feedback_type,
        feedback_text: input.feedback_text ?? null,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(`Failed to insert feedback: ${error?.message}`);

    await this.applyToProfile(userId, insight.insight_type as string, input.feedback_type);
    await this.applyStatusSideEffects(userId, insightId, input.feedback_type);

    return data as InsightFeedback;
  }

  async loadInsightTypeWeights(userId: string): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .admin()
      .from('users')
      .select('settings_json')
      .eq('id', userId)
      .single();
    if (error || !data) return {};
    const settings = (data.settings_json as Record<string, unknown> | null) ?? {};
    const weights = (settings.insight_type_weights as Record<string, number> | undefined) ?? {};
    return weights;
  }

  private async applyToProfile(
    userId: string,
    insightType: string,
    feedbackType: CreateFeedbackInput['feedback_type'],
  ): Promise<void> {
    const delta = WEIGHT_DELTAS[feedbackType] ?? 0;
    if (delta === 0) return;

    const admin = this.supabase.admin();
    const { data, error } = await admin
      .from('users')
      .select('settings_json')
      .eq('id', userId)
      .single();
    if (error || !data) return;

    const settings = ((data.settings_json as Record<string, unknown> | null) ?? {}) as Record<
      string,
      unknown
    >;
    const weights = ((settings.insight_type_weights as Record<string, number> | undefined) ??
      {}) as Record<string, number>;
    const current = weights[insightType] ?? 1;
    const next = Math.max(0, Math.min(2, current + delta));
    weights[insightType] = round(next);
    settings.insight_type_weights = weights;

    await admin.from('users').update({ settings_json: settings }).eq('id', userId);
  }

  private async applyStatusSideEffects(
    userId: string,
    insightId: string,
    feedbackType: CreateFeedbackInput['feedback_type'],
  ): Promise<void> {
    let nextStatus: 'saved' | 'dismissed' | null = null;
    if (feedbackType === 'save' || feedbackType === 'important') nextStatus = 'saved';
    if (feedbackType === 'dismiss' || feedbackType === 'wrong' || feedbackType === 'boring') {
      nextStatus = 'dismissed';
    }
    if (!nextStatus) return;
    await this.supabase
      .admin()
      .from('insights')
      .update({ status: nextStatus })
      .eq('id', insightId)
      .eq('user_id', userId);
  }
}

const WEIGHT_DELTAS: Record<string, number> = {
  accurate: +0.1,
  important: +0.1,
  save: +0.05,
  expand: +0.05,
  uncomfortable: +0.05,
  partially_accurate: 0,
  wrong: -0.15,
  inaccurate: -0.15,
  boring: -0.1,
  dismiss: -0.1,
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
