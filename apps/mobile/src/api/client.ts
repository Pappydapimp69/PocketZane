import { supabase } from '../lib/supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000';

class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const auth = await authHeader();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...auth,
      ...(headers as Record<string, string> | undefined),
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(res.status, `${res.status} ${res.statusText}`, body);
  }
  return (await res.json()) as T;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export { ApiError, BASE_URL };
