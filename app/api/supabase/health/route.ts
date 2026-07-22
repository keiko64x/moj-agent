import { NextResponse } from 'next/server';
import { createSupabaseClient, isSupabaseConfigured } from '@/app/lib/supabase';

const REQUIRED_TABLES = ['conversations', 'messages', 'user_profiles'] as const;

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
      tables[table] = false;
      errors.push(`${table}: ${error.message}`);
    } else {
      tables[table] = true;
    }
  }

  // SELECT może przejść przy RLS bez polityk — sprawdzamy też INSERT
  let canWrite = false;
  let writeError: string | null = null;

  if (tables.conversations) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ title: '__health_check__', updated_at: new Date().toISOString() })
      .select('id')
      .single();

    if (error) {
      writeError = error.message;
      errors.push(`write conversations: ${error.message}`);
      if (/row-level security/i.test(error.message)) {
        errors.push(
          'RLS jest włączone bez polityk. Uruchom supabase/fix-rls.sql w SQL Editor (albo schema.sql).',
        );
      }
    } else if (data?.id) {
      canWrite = true;
      await supabase.from('conversations').delete().eq('id', data.id);
    }
  }

  const allOk = REQUIRED_TABLES.every((t) => tables[t]) && canWrite;

  return NextResponse.json({
    ok: allOk,
    configured: true,
    canWrite,
    message: allOk
      ? 'Supabase podłączony — tabele gotowe, zapis działa'
      : writeError && /row-level security/i.test(writeError)
        ? 'Tabele istnieją, ale RLS blokuje zapis. W SQL Editor uruchom: supabase/fix-rls.sql'
        : `Supabase skonfigurowany, ale coś nie gra. ${errors.join(' | ')}`,
    tables,
    errors,
  });
}
