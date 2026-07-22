import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl?.startsWith('http') && supabaseAnonKey && supabaseAnonKey.length > 20);
}

/**
 * Klient przeglądarkowy / serwerowy Supabase (anon key).
 * Wymaga NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local
 */
export function createSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured() || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

/** Singleton do użycia w kliencie (lazy). */
let browserClient: SupabaseClient<Database> | null | undefined;

export function getSupabase(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') {
    return createSupabaseClient();
  }
  if (browserClient === undefined) {
    browserClient = createSupabaseClient();
  }
  return browserClient;
}
