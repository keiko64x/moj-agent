-- NAPRAWBAZA WIEDZY (RAG) po logowaniu
-- Błąd: Could not find the function public.match_documents(filter...
-- Przyczyna: w bazie jest stara funkcja (3 parametry), a aplikacja woła 4. (filter_user_id)
--
-- Supabase → SQL Editor → Run ten plik → potem NOTIFY pgrst, 'reload schema';

-- 1) Kolumna user_id (jeśli brak)
alter table public.documents
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists documents_user_id_idx on public.documents (user_id);

-- 2) Usuń stare przeciążenia funkcji (ważne!)
drop function if exists public.match_documents(vector, double precision, integer);
drop function if exists public.match_documents(vector, float, int);
drop function if exists public.match_documents(vector, double precision, integer, uuid);
drop function if exists public.match_documents(vector, float, int, uuid);

-- 3) Nowa funkcja z filter_user_id
--    Szuka: dokumenty usera ORAZ wspólne (user_id IS NULL) — cennik firmowy
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
  if filter_user_id is null then
    raise exception 'filter_user_id is required';
  end if;

  return query
  select
    d.id,
    d.title,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::float as similarity
  from public.documents d
  where d.embedding is not null
    and (d.user_id = filter_user_id or d.user_id is null)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function public.match_documents(vector, float, int, uuid) to anon, authenticated;

-- 4) Odśwież cache API PostgREST (Supabase)
notify pgrst, 'reload schema';

-- 5) Sprawdź: ile masz dokumentów?
-- select user_id, count(*) from documents group by user_id;
-- Jeśli 0 wierszy → wejdź na /upload (zalogowany) i wgraj cennik/FAQ ponownie.
