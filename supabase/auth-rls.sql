-- Lekcja 7 / Warsztat 3 — Login + prywatność (user_id + RLS)
-- Wklej w Supabase Dashboard → SQL Editor → Run
-- Po uruchomieniu: Authentication → Providers → Email włączony
-- I wyłącz „Confirm email” na czas warsztatu (Auth → Providers → Email),
-- albo potwierdzaj maile — inaczej signUp nie da sesji od razu.

-- 1) Kolumny user_id
alter table public.conversations
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.documents
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists documents_user_id_idx on public.documents (user_id);

-- 2) Wyczyść stare dane bez właściciela (sieroty z L05–L06)
delete from public.messages
where conversation_id in (
  select id from public.conversations where user_id is null
);
delete from public.conversations where user_id is null;
delete from public.documents where user_id is null;
-- stare profile z losowym UUID (localStorage) — nowe = auth.uid()
delete from public.user_profiles;

-- 3) match_documents z filtrem user_id (SECURITY DEFINER — API serwera
--    wyszukuje z anon key + filter_user_id z body; zawsze filtruje po właścicielu)
create or replace function match_documents(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_user_id uuid default null
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if filter_user_id is null then
    raise exception 'filter_user_id is required';
  end if;

  return query
  select
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.embedding is not null
    and documents.user_id = filter_user_id
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 4) Uprawnienia
grant usage on schema public to anon, authenticated;
grant all on table public.conversations to authenticated;
grant all on table public.messages to authenticated;
grant all on table public.user_profiles to authenticated;
grant all on table public.documents to authenticated;
grant execute on function match_documents(vector, float, int, uuid) to anon, authenticated;

-- anon bez pełnego dostępu do cudzych danych (RLS poniżej)
revoke all on table public.conversations from anon;
revoke all on table public.messages from anon;
revoke all on table public.user_profiles from anon;
revoke all on table public.documents from anon;

-- 5) RLS — każdy user tylko swoje wiersze
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.documents enable row level security;

alter table public.conversations force row level security;
alter table public.messages force row level security;
alter table public.user_profiles force row level security;
alter table public.documents force row level security;

-- Usuń stare polityki (jeśli były)
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'messages', 'user_profiles', 'documents')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "conversations_own"
  on public.conversations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "messages_own"
  on public.messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "user_profiles_own"
  on public.user_profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "documents_own"
  on public.documents
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
