-- MOCNIEJSZA NAPRAWA RLS — uruchom w SQL Editor projektu, do którego
-- wskazuje NEXT_PUBLIC_SUPABASE_URL w .env.local (musi być TEN SAM projekt!).
--
-- 1) Sprawdź status (wynik: relrowsecurity powinno być false)
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('conversations', 'messages', 'user_profiles');

-- 2) Usuń WSZYSTKIE polityki RLS na tych tabelach
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'messages', 'user_profiles')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3) Wyłącz RLS (i force)
alter table public.conversations disable row level security;
alter table public.messages disable row level security;
alter table public.user_profiles disable row level security;

alter table public.conversations no force row level security;
alter table public.messages no force row level security;
alter table public.user_profiles no force row level security;

-- 4) Uprawnienia dla klucza anon (przeglądarka)
grant usage on schema public to anon, authenticated;
grant all on table public.conversations to anon, authenticated;
grant all on table public.messages to anon, authenticated;
grant all on table public.user_profiles to anon, authenticated;

-- 5) Test zapisu (powinien zwrócić 1 wiersz, potem go kasujemy)
insert into public.conversations (title)
values ('__rls_fix_test__')
returning id, title;

delete from public.conversations where title = '__rls_fix_test__';

-- 6) Ponownie sprawdź status — rls_enabled = false
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('conversations', 'messages', 'user_profiles');
