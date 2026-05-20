-- Insights and the feedback loop that personalizes them.

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  insight_type text not null check (insight_type in (
    'recurrence',
    'contradiction',
    'correlation',
    'temporal_pattern',
    'resurfaced_theme',
    'behavioral_loop',
    'emotional_shift',
    'identity_drift'
  )),
  title text not null,
  body text not null,
  confidence numeric not null default 0,
  evidence_entry_ids uuid[] not null default '{}',
  related_node_ids uuid[] not null default '{}',
  dedup_key text not null,
  status text not null default 'active' check (status in ('active', 'dismissed', 'saved', 'superseded')),
  generated_at timestamptz not null default now()
);

-- One insight per (user, insight_type, dedup_key). Generator emits a stable key
-- so we don't surface the same recurrence twice.
create unique index if not exists insights_user_type_dedup_uq
  on public.insights (user_id, insight_type, dedup_key);

create table if not exists public.insight_feedback (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.insights(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  feedback_type text not null check (feedback_type in (
    'accurate',
    'partially_accurate',
    'wrong',
    'important',
    'uncomfortable',
    'boring',
    'save',
    'dismiss',
    'expand',
    'inaccurate'
  )),
  feedback_text text,
  created_at timestamptz not null default now()
);
