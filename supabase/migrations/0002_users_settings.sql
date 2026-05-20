-- App-level user mirror, keyed by Supabase auth.users.id.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  timezone text not null default 'UTC',
  settings_json jsonb not null default '{}'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));

-- Auto-provision public.users on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
