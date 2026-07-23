import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthUserId } from '@/app/lib/auth';
import { getSupabase } from '@/app/lib/supabase';
import { embedText } from '@/app/lib/embeddings';
import type { Database, DocumentRow, Json } from '@/app/lib/supabase-types';

export type KnowledgeDocSummary = {
  title: string;
  chunk_count: number;
  created_at: string;
};

/** Lista wspólnej bazy wiedzy (wszyscy zalogowani widzą to samo). */
export async function listKnowledgeDocuments(): Promise<KnowledgeDocSummary[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // Wymagamy sesji — AuthGate i tak chroni /upload, /knowledge
  const userId = await getAuthUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('title, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listKnowledgeDocuments', error.message);
    throw new Error(error.message);
  }

  const byTitle = new Map<string, KnowledgeDocSummary>();
  for (const row of data ?? []) {
    const title = (row.title ?? 'Bez tytułu').trim() || 'Bez tytułu';
    const existing = byTitle.get(title);
    if (!existing) {
      byTitle.set(title, {
        title,
        chunk_count: 1,
        created_at: row.created_at,
      });
    } else {
      existing.chunk_count += 1;
      if (row.created_at < existing.created_at) {
        existing.created_at = row.created_at;
      }
    }
  }

  return Array.from(byTitle.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export async function deleteKnowledgeDocument(title: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !title.trim()) return false;

  const userId = await getAuthUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('title', title.trim());
  if (error) {
    console.error('deleteKnowledgeDocument', error.message);
    return false;
  }
  return true;
}

/** Zapis fragmentu do wspólnej bazy (user_id = null). */
export async function insertDocumentChunk(input: {
  title: string;
  content: string;
  embedding: number[];
  metadata: Json;
  /** Ignorowane — baza wiedzy jest współdzielona. */
  userId?: string;
  client?: SupabaseClient<Database> | null;
}): Promise<DocumentRow | null> {
  const supabase = input.client ?? getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title: input.title,
      content: input.content,
      embedding: input.embedding,
      metadata: input.metadata,
      user_id: null,
    })
    .select('id, created_at, title, content, metadata, user_id')
    .single();

  if (error) {
    console.error('insertDocumentChunk', error.message);
    throw new Error(error.message);
  }

  return data as DocumentRow;
}

export type KnowledgeMatch = {
  id: string;
  title: string | null;
  content: string | null;
  metadata: Json;
  similarity: number;
  added_at?: string;
};

/**
 * Wyszukiwanie we wspólnej bazie wiedzy.
 * filterUserId jest opcjonalny i NIE ogranicza wyników (personalizacja jest osobno).
 */
export async function searchKnowledgeDocuments(
  query: string,
  matchThreshold = 0.5,
  matchCount = 5,
  _filterUserId?: string | null,
): Promise<{
  results: KnowledgeMatch[];
  total_found: number;
  source_documents: string[];
  message?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      results: [],
      total_found: 0,
      source_documents: [],
      message: 'Supabase nie jest skonfigurowane.',
    };
  }

  const embedding = await embedText(query, 'RETRIEVAL_QUERY');

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    // parametr zostaje dla kompatybilności ze starą sygnaturą SQL — funkcja go ignoruje
    filter_user_id: null,
  });

  if (error) {
    console.error('searchKnowledgeDocuments', error.message);
    const hint = /match_documents|Could not find the function|filter_user_id is required/i.test(
      error.message,
    )
      ? ' Uruchom w Supabase SQL Editor: supabase/shared-knowledge.sql'
      : '';
    return {
      results: [],
      total_found: 0,
      source_documents: [],
      message: `${error.message}.${hint}`,
    };
  }

  const raw = (data ?? []) as Omit<KnowledgeMatch, 'added_at'>[];
  const ids = raw.map((row) => row.id).filter(Boolean);

  let createdById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: dates } = await supabase
      .from('documents')
      .select('id, created_at')
      .in('id', ids);
    createdById = new Map(
      (dates ?? []).map((row) => [row.id, row.created_at.slice(0, 10)]),
    );
  }

  const results: KnowledgeMatch[] = raw
    .filter((row) => (row.similarity ?? 0) >= matchThreshold)
    .map((row) => ({
      ...row,
      added_at: createdById.get(row.id),
    }));

  const source_documents = [
    ...new Set(results.map((r) => (r.title ?? '').trim()).filter(Boolean)),
  ];

  if (results.length === 0) {
    return {
      results: [],
      total_found: 0,
      source_documents: [],
      message:
        'Nie znaleziono informacji w bazie wiedzy. Sprawdź /upload — dokumenty są wspólne dla wszystkich userów.',
    };
  }

  return {
    results,
    total_found: results.length,
    source_documents,
  };
}

export async function getChunksByTitle(title: string): Promise<DocumentRow[]> {
  const supabase = getSupabase();
  if (!supabase || !title.trim()) return [];

  const userId = await getAuthUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('id, created_at, title, content, metadata, user_id')
    .eq('title', title.trim())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getChunksByTitle', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as DocumentRow[];
}

export async function countKnowledgeStats(): Promise<{
  documents: number;
  chunks: number;
}> {
  const list = await listKnowledgeDocuments();
  return {
    documents: list.length,
    chunks: list.reduce((sum, doc) => sum + doc.chunk_count, 0),
  };
}
