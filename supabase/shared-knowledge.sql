-- Wspólna baza wiedzy dla WSZYSTKICH zalogowanych userów
-- Personalizacja (imię, preferencje, rozmowy) nadal per user.
-- Supabase → SQL Editor → Run

-- 1) Istniejące dokumenty → wspólne (user_id = null)
alter table public.documents
  add column if not exists user_id uuid references auth.users (id) on delete set null;

update public.documents set user_id = null;

-- 2) Funkcja RAG: szuka w CAŁEJ bazie wiedzy (wspólnej)
drop function if exists public.match_documents(vector, double precision, integer);
drop function if exists public.match_documents(vector, float, int);
drop function if exists public.match_documents(vector, double precision, integer, uuid);
drop function if exists public.match_documents(vector, float, int, uuid);

create or replace function public.match_documents(
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
  -- filter_user_id ignorowany: baza wiedzy jest współdzielona
  return query
  select
    d.id,
    d.title,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::float as similarity
  from public.documents d
  where d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function public.match_documents(vector, float, int, uuid) to anon, authenticated;

-- 3) RLS: documents wspólne (czytanie/zapis dla każdego zalogowanego)
alter table public.documents enable row level security;
alter table public.documents force row level security;

drop policy if exists "documents_own" on public.documents;
drop policy if exists "documents_read_all" on public.documents;
drop policy if exists "documents_write_shared" on public.documents;
drop policy if exists "documents_update_shared" on public.documents;
drop policy if exists "documents_delete_shared" on public.documents;
drop policy if exists "documents_all_authenticated" on public.documents;

grant all on table public.documents to authenticated;

create policy "documents_all_authenticated"
  on public.documents
  for all
  to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';

-- Sprawdzenie:
-- select count(*) as chunks, count(distinct title) as docs from documents;
