-- Helpers for memory retrieval (vector similarity) and feed ranking.
-- These run as SECURITY DEFINER so workers can call them with the service
-- role; callers must pass p_user_id explicitly.

create or replace function public.match_entries(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_match_count integer default 10,
  p_min_similarity numeric default 0.5,
  p_exclude_entry_id uuid default null,
  p_include_locked boolean default false
)
returns table (
  entry_id uuid,
  similarity numeric,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    e.id as entry_id,
    (1 - (ee.embedding <=> p_query_embedding))::numeric as similarity,
    e.created_at
  from public.entry_embeddings ee
  join public.entries e on e.id = ee.entry_id
  where ee.user_id = p_user_id
    and (p_exclude_entry_id is null or e.id <> p_exclude_entry_id)
    and (p_include_locked or e.privacy_level <> 'LOCKED')
    and (1 - (ee.embedding <=> p_query_embedding)) >= p_min_similarity
  order by ee.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
end;
$$;

revoke all on function public.match_entries(uuid, vector, integer, numeric, uuid, boolean) from public;
grant execute on function public.match_entries(uuid, vector, integer, numeric, uuid, boolean) to service_role;
