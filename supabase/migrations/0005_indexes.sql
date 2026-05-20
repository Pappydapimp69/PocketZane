-- Hot-path indexes.

create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);

create index if not exists entries_user_status_idx
  on public.entries (user_id, processing_status);

create index if not exists extractions_user_created_idx
  on public.extractions (user_id, created_at desc);

create index if not exists extractions_entities_gin on public.extractions using gin (entities);
create index if not exists extractions_emotions_gin on public.extractions using gin (emotions);
create index if not exists extractions_themes_gin on public.extractions using gin (themes);

create index if not exists insights_user_generated_idx
  on public.insights (user_id, generated_at desc);

create index if not exists insights_user_status_idx
  on public.insights (user_id, status);

create index if not exists insight_feedback_user_created_idx
  on public.insight_feedback (user_id, created_at desc);

-- ivfflat needs a column-specific operator class and an empty table at build
-- time is fine; the index is rebuildable later.
create index if not exists entry_embeddings_embedding_idx
  on public.entry_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists entry_embeddings_user_idx
  on public.entry_embeddings (user_id);
