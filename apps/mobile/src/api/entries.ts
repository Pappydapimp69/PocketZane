import type { CreateEntryInput, Entry, Extraction } from '@signal/shared';
import { apiFetch } from './client';

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  return apiFetch<Entry>('/entries', { method: 'POST', json: input });
}

export interface EntryDetail {
  entry: Entry;
  extraction: Extraction | null;
}

export async function getEntry(id: string): Promise<EntryDetail> {
  return apiFetch<EntryDetail>(`/entries/${id}`);
}
