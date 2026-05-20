import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { CreateEntryInput, Entry, Extraction } from '@signal/shared';
import { SupabaseService } from '../supabase/supabase.service';
import { EXTRACT_QUEUE_TOKEN } from '../queue/queue.module';
import type { ExtractJobData } from '../queue/queue.tokens';

export interface EntryDetail {
  entry: Entry;
  extraction: Extraction | null;
}

@Injectable()
export class EntriesService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(EXTRACT_QUEUE_TOKEN) private readonly extractQueue: Queue<ExtractJobData>,
  ) {}

  async create(userId: string, input: CreateEntryInput): Promise<Entry> {
    const admin = this.supabase.admin();

    const { data, error } = await admin
      .from('entries')
      .insert({
        user_id: userId,
        raw_text: input.raw_text,
        source_type: input.source_type,
        privacy_level: input.privacy_level,
        client_timezone: input.client_timezone,
        user_mood: input.user_mood ?? null,
        user_tags: input.user_tags ?? null,
        occurred_at: input.occurred_at ?? null,
        processing_status: 'queued',
      })
      .select('*')
      .single();

    if (error || !data) throw new Error(`Failed to insert entry: ${error?.message}`);

    await this.extractQueue.add(
      'extract',
      { entry_id: data.id, user_id: userId },
      { jobId: `extract:${data.id}` },
    );

    return data as Entry;
  }

  async listForUser(userId: string, limit = 50): Promise<Entry[]> {
    const { data, error } = await this.supabase
      .admin()
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []) as Entry[];
  }

  async getById(userId: string, entryId: string): Promise<EntryDetail> {
    const { data, error } = await this.supabase
      .admin()
      .from('entries')
      .select('*, extractions(*)')
      .eq('user_id', userId)
      .eq('id', entryId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Entry not found');

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
