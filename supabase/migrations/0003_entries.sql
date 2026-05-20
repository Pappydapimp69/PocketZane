-- Core capture surface: entries + their derived extractions + embeddings.

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  raw_text text not null,
  normalized_text text,
  source_type text not null default 'TEXT' check (source_type in ('TEXT', 'VOICE', 'IMAGE')),
  media_url text,
  privacy_level text not null default 'NORMAL' check (privacy_level in ('NORMAL', 'SENSITIVE', 'LOCKED')),
  processing_status text not null default 'queued' check (
    processing_status in ('queued', 'extracting', 'embedding', 'ready', 'extraction_failed', 'embedding_failed')
  ),
  user_mood smallint check (user_mood between 1 and 5),
  user_tags text[],
  client_timezone text,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  summary text not null,
  confidence numeric not null default 0,
  entities jsonb not null default '[]'::jsonb,
  emotions jsonb not null default '[]'::jsonb,
  behaviors jsonb not null default '[]'::jsonb,
  themes jsonb not null default '[]'::jsonb,
  symptoms jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  temporal_refs jsonb not null default '[]'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 768 dims = Google text-embedding-004.
create table if not exists public.entry_embeddings (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  embedding vector(768) not null,
  model text not null,
  created_at timestamptz not null default now()
);
