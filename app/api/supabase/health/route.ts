import { NextResponse } from 'next/server';
import { createSupabaseClient, isSupabaseConfigured } from '@/app/lib/supabase';

const REQUIRED_TABLES = ['conversations', 'messages', 'user_profiles', 'documents'] as const;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message:
        'Brak kluczy Supabase. Dodaj NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY do .env.local',
      tables: Object.fromEntries(REQUIRED_TABLES.map((t) => [t, false])),
      canWrite: false,
    });
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Nie udało się utworzyć klienta Supabase',
      tables: Object.fromEntries(REQUIRED_TABLES.map((t) => [t, false])),
      canWrite: false,
    });
  }

  const tables: Record<string, boolean> = {};
  const errors: string[] = [];

  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error) {
      // Po auth-rls.sql anon nie czyta tabel — to OK, tabela istnieje
      if (/permission denied|row-level security|JWT/i.test(error.message)) {
        tables[table] = true;
      } else {
        tables[table] = false;
        errors.push(`${table}: ${error.message}`);
      }
    } else {
      tables[table] = true;
    }
  }

  // Zapis działa tylko dla zalogowanego usera (RLS) — health bez JWT nie testuje INSERT
  const canWrite = false;
  const allTablesOk = REQUIRED_TABLES.every((t) => tables[t]);

  return NextResponse.json({
    ok: allTablesOk,
    configured: true,
    canWrite,
    message: allTablesOk
      ? 'Supabase podłączony. Zapisy rozmów/dokumentów wymagają logowania (RLS). Uruchom supabase/auth-rls.sql jeśli jeszcze nie.'
      : `Supabase skonfigurowany, ale coś nie gra. ${errors.join(' | ')}`,
    tables,
    errors,
    authRequired: true,
  });
}
