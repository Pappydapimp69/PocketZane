import { apiFetch, BASE_URL } from './client';
import { supabase } from '../lib/supabase';

export async function deleteAccount(): Promise<void> {
  await apiFetch('/me', { method: 'DELETE' });
}

export async function exportData(): Promise<unknown> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${BASE_URL}/me/export`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.json();
}
