-- Naprawa zapisu imienia / profilu (L07 W3+W4)
-- Wklej w Supabase → SQL Editor → Run
-- Problem: anon nie ma GRANT, a API bez JWT nie może pisać do user_profiles.
-- Dodatkowo: RLS powinno być WŁĄCZONE (prywatność), nie "UNRESTRICTED".

-- 1) Uprawnienia dla zalogowanych
grant usage on schema public to authenticated;
grant all on table public.user_profiles to authenticated;
grant all on table public.conversations to authenticated;
grant all on table public.messages to authenticated;
grant all on table public.documents to authenticated;

-- 2) Włącz RLS + polityka: każdy tylko swój profil (id = auth.uid())
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;

drop policy if exists "user_profiles_own" on public.user_profiles;
create policy "user_profiles_own"
  on public.user_profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3) (Opcjonalnie) włącz RLS też na pozostałych tabelach jeśli są UNRESTRICTED
-- Uruchom pełny supabase/auth-rls.sql jeśli jeszcze nie.
