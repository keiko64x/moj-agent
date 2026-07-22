'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  countKnowledgeStats,
  getChunksByTitle,
  listKnowledgeDocuments,
  searchKnowledgeDocuments,
  type KnowledgeDocSummary,
  type KnowledgeMatch,
} from '@/app/lib/knowledge';
import type { DocumentRow } from '@/app/lib/supabase-types';
import { isSupabaseConfigured } from '@/app/lib/supabase';

function KnowledgePageInner() {
  const searchParams = useSearchParams();
  const initialDoc = searchParams.get('doc')?.trim() || '';

  const [docs, setDocs] = useState<KnowledgeDocSummary[]>([]);
  const [stats, setStats] = useState({ documents: 0, chunks: 0 });
  const [selectedTitle, setSelectedTitle] = useState(initialDoc);
  const [chunks, setChunks] = useState<DocumentRow[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KnowledgeMatch[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [searchMessage, setSearchMessage] = useState('');

  const loadList = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Brak konfiguracji Supabase. Uzupełnij klucze w /setup.');
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      const [list, counts] = await Promise.all([
        listKnowledgeDocuments(),
        countKnowledgeStats(),
      ]);
      setDocs(list);
      setStats(counts);
      setError('');
      setSelectedTitle((prev) => prev || list[0]?.title || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać bazy wiedzy');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (initialDoc) setSelectedTitle(initialDoc);
  }, [initialDoc]);

  useEffect(() => {
    if (!selectedTitle) {
      setChunks([]);
      return;
    }
    let cancelled = false;
    setLoadingChunks(true);
    void getChunksByTitle(selectedTitle)
      .then((rows) => {
        if (!cancelled) setChunks(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Błąd podglądu fragmentów');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingChunks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTitle]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchMessage('');
    setError('');
    try {
      const result = await searchKnowledgeDocuments(q, 0.3, 8);
      setHits(result.results);
      setSearchMessage(
        result.total_found === 0
          ? 'Brak trafień — RAG nie znajdzie odpowiedzi na to pytanie.'
          : `Znaleziono ${result.total_found} fragment(ów).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd wyszukiwania');
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  const statusLine = useMemo(
    () => `${stats.chunks} fragmentów z ${stats.documents} dokumentów`,
    [stats],
  );

  return (
    <main className="knowledge-main">
      <header className="knowledge-header">
        <p className="knowledge-eyebrow">Lekcja 6 · Warsztat 4</p>
        <h1 className="knowledge-title">📚 Twoja baza wiedzy</h1>
        <p className="knowledge-subtitle">
          Podgląd dokumentów i test wyszukiwania RAG — bez rozmowy z agentem
        </p>
        <p className="knowledge-status">{statusLine}</p>
        <div className="knowledge-actions">
          <Link href="/upload" className="knowledge-primary-btn">
            📤 Dodaj dokument
          </Link>
          <Link href="/chat" className="knowledge-secondary-btn">
            💬 Zapytaj agenta
          </Link>
        </div>
      </header>

      {!isSupabaseConfigured() && (
        <p className="knowledge-error">
          Brak kluczy Supabase. <Link href="/setup">Przejdź do /setup</Link>
        </p>
      )}
      {error && <p className="knowledge-error">{error}</p>}

      <section className="knowledge-search-panel">
        <h2 className="knowledge-section-title">Szukaj w bazie wiedzy…</h2>
        <form className="knowledge-search-form" onSubmit={handleSearch}>
          <input
            type="search"
            className="knowledge-search-input"
            placeholder="Np. Pepperoni, VIP, dostawa, regulamin…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={searching}
          />
          <button type="submit" className="knowledge-search-btn" disabled={searching || !query.trim()}>
            {searching ? 'Szukam…' : '🔍 Szukaj'}
          </button>
        </form>
        {searchMessage && <p className="knowledge-muted">{searchMessage}</p>}
        {hits.length > 0 && (
          <ul className="knowledge-hits">
            {hits.map((hit) => (
              <li key={hit.id} className="knowledge-hit">
                <div className="knowledge-hit-top">
                  <button
                    type="button"
                    className="knowledge-hit-title"
                    onClick={() => setSelectedTitle(hit.title ?? '')}
                  >
                    {hit.title || 'Bez tytułu'}
                  </button>
                  <span className="knowledge-sim">
                    similarity {(hit.similarity * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="knowledge-hit-content">{hit.content}</p>
                {hit.added_at && (
                  <p className="knowledge-hit-meta">Dodano: {hit.added_at}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="knowledge-docs-panel">
        <h2 className="knowledge-section-title">Dokumenty</h2>
        {loadingList ? (
          <p className="knowledge-muted">Ładuję listę…</p>
        ) : docs.length === 0 ? (
          <p className="knowledge-empty">
            Brak dokumentów. <Link href="/upload">Wgraj cennik lub FAQ</Link>
          </p>
        ) : (
          <div className="knowledge-docs-grid">
            <ul className="knowledge-doc-list">
              {docs.map((doc) => (
                <li key={doc.title}>
                  <button
                    type="button"
                    className={
                      selectedTitle === doc.title
                        ? 'knowledge-doc-btn knowledge-doc-btn-active'
                        : 'knowledge-doc-btn'
                    }
                    onClick={() => setSelectedTitle(doc.title)}
                  >
                    <span>{doc.title}</span>
                    <span className="knowledge-doc-count">{doc.chunk_count} frag.</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="knowledge-chunks">
              <h3 className="knowledge-chunks-title">
                {selectedTitle ? `Fragmenty: ${selectedTitle}` : 'Wybierz dokument'}
              </h3>
              {loadingChunks ? (
                <p className="knowledge-muted">Ładuję fragmenty…</p>
              ) : chunks.length === 0 ? (
                <p className="knowledge-muted">Brak fragmentów do podglądu.</p>
              ) : (
                <ol className="knowledge-chunk-list">
                  {chunks.map((chunk, index) => (
                    <li key={chunk.id} className="knowledge-chunk">
                      <p className="knowledge-chunk-meta">
                        #{index + 1} · {new Date(chunk.created_at).toLocaleString('pl-PL')}
                      </p>
                      <p className="knowledge-chunk-content">{chunk.content}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <main className="knowledge-main">
          <p className="knowledge-muted">Ładowanie bazy wiedzy…</p>
        </main>
      }
    >
      <KnowledgePageInner />
    </Suspense>
  );
}
