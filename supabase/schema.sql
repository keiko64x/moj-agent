-- Agentosław / Lekcja 5 — Warsztat 1
-- Wklej w Supabase Dashboard → SQL Editor → Run
-- Tworzy tabele: conversations, messages, user_profiles (RLS wyłączone na razie)

create extension if not exists "pgcrypto";

-- 1) Lista rozmów
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text,
  updated_at timestamptz not null default now()
);

-- 2) Wiadomości w rozmowach
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null
);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id);

create index if not exists messages_created_at_idx
  on public.messages (created_at);

-- 3) Profil użytkownika
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  preferences jsonb not null default '{}'::jsonb
);

-- RLS WYŁĄCZONE (warsztat L05) — włączymy w L07.
-- Ważne: w Table Editor Supabase domyślnie WŁĄCZA RLS.
-- Jeśli widzisz "violates row-level security policy" → uruchom też fix-rls.sql
alter table public.conversations disable row level security;
alter table public.messages disable row level security;
alter table public.user_profiles disable row level security;
