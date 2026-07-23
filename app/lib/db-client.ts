import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseClientWithToken,
  getSupabase,
} from '@/app/lib/supabase';
import type { Database } from '@/app/lib/supabase-types';

export type DbClient = SupabaseClient<Database>;

export function resolveDbClient(client?: DbClient | null): DbClient | null {
  return client ?? getSupabase();
}

/** Bearer token z nagłówka Authorization. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

/** Klient Supabase z JWT z requestu (RLS = auth.uid()). */
export function getRequestSupabase(req: Request): DbClient | null {
  const token = getBearerToken(req);
  if (!token) return getSupabase();
  return createSupabaseClientWithToken(token) ?? getSupabase();
}
