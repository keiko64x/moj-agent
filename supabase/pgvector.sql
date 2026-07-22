-- Lekcja 6 / Warsztat 1+2 — pgvector + tabela documents
-- Wklej w Supabase Dashboard → SQL Editor → Run
-- Wymaga: Extensions → pgvector (Enable)

create extension if not exists vector;
create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text,
  content text,
  embedding vector(768),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists documents_title_idx on public.documents (title);
create index if not exists documents_created_at_idx on public.documents (created_at desc);

-- Similarity search (cosine distance)
create or replace function match_documents(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.embedding is not null
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

alter table public.documents disable row level security;
grant all on table public.documents to anon, authenticated;
