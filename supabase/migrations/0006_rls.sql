-- Row-level security: every row is scoped to its owning user.
-- Service-role key bypasses RLS, which is what worker jobs use.

alter table public.users enable row level security;
alter table public.entries enable row level security;
alter table public.extractions enable row level security;
alter table public.entry_embeddings enable row level security;
alter table public.insights enable row level security;
alter table public.insight_feedback enable row level security;

-- users: read/update own row only.
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
  for select using (id = auth.uid());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- entries: owner-only CRUD.
drop policy if exists entries_owner_all on public.entries;
create policy entries_owner_all on public.entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- extractions: owner read-only (writes happen via service role).
drop policy if exists extractions_owner_read on public.extractions;
create policy extractions_owner_read on public.extractions
  for select using (user_id = auth.uid());

drop policy if exists extractions_owner_update on public.extractions;
create policy extractions_owner_update on public.extractions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- entry_embeddings: owner read-only.
drop policy if exists entry_embeddings_owner_read on public.entry_embeddings;
create policy entry_embeddings_owner_read on public.entry_embeddings
  for select using (user_id = auth.uid());

-- insights: owner read + status updates (save/dismiss).
drop policy if exists insights_owner_read on public.insights;
create policy insights_owner_read on public.insights
  for select using (user_id = auth.uid());

drop policy if exists insights_owner_update on public.insights;
create policy insights_owner_update on public.insights
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- insight_feedback: owner can insert + read own.
drop policy if exists insight_feedback_owner_insert on public.insight_feedback;
create policy insight_feedback_owner_insert on public.insight_feedback
  for insert with check (user_id = auth.uid());

drop policy if exists insight_feedback_owner_read on public.insight_feedback;
create policy insight_feedback_owner_read on public.insight_feedback
  for select using (user_id = auth.uid());
