'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  deleteConversation,
  formatConversationWhen,
  listConversationsWithMeta,
  type ConversationListItem,
} from '@/app/lib/conversations';
import { isSupabaseConfigured } from '@/app/lib/supabase';

export default function HistoryPage() {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Brak konfiguracji Supabase. Uzupełnij klucze w /setup.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list = await listConversationsWithMeta();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać historii');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const title = (item.title ?? '').toLowerCase();
      const preview = (item.last_message_preview ?? '').toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [items, query]);

  async function handleDelete(item: ConversationListItem, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const ok = window.confirm(
      'Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.',
    );
    if (!ok) return;

    setDeletingId(item.id);
    const success = await deleteConversation(item.id);
    setDeletingId(null);
    if (!success) {
      setToast('Nie udało się usunąć rozmowy');
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    setToast('Rozmowa usunięta');
  }

  return (
    <main className="history-main">
      <header className="history-header">
        <p className="history-eyebrow">Lekcja 5 · Warsztat 4</p>
        <h1 className="history-title">📜 Historia rozmów</h1>
        <p className="history-subtitle">Wszystkie Twoje rozmowy z agentem</p>
      </header>

      <div className="history-toolbar">
        <input
          type="search"
          className="history-search"
          placeholder="Szukaj w rozmowach..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj w rozmowach"
        />
        <Link href="/chat" className="history-primary-btn">
          + Nowa rozmowa
        </Link>
      </div>

      {toast && <div className="history-toast">{toast}</div>}
      {error && <p className="history-error">{error}</p>}

      {loading ? (
        <p className="history-muted">Ładowanie historii…</p>
      ) : filtered.length === 0 ? (
        <div className="history-empty">
          <p>
            {items.length === 0
              ? 'Nie masz jeszcze żadnych rozmów. Zacznij nową!'
              : 'Brak rozmów pasujących do wyszukiwania.'}
          </p>
          {items.length === 0 && (
            <Link href="/chat" className="history-primary-btn">
              Rozpocznij rozmowę
            </Link>
          )}
        </div>
      ) : (
        <ul className="history-list">
          {filtered.map((item) => {
            const title = item.title?.trim() || 'Bez tytułu';
            return (
              <li key={item.id} className="history-card-wrap">
                <Link href={`/history/${item.id}`} className="history-card">
                  <div className="history-card-top">
                    <h2 className="history-card-title">{title}</h2>
                    <button
                      type="button"
                      className="history-delete-btn"
                      onClick={(e) => void handleDelete(item, e)}
                      disabled={deletingId === item.id}
                      aria-label="Usuń rozmowę"
                      title="Usuń rozmowę"
                    >
                      {deletingId === item.id ? '…' : '🗑️'}
                    </button>
                  </div>
                  <p className="history-card-meta">
                    {formatConversationWhen(item.updated_at)}
                    {' · '}
                    {item.message_count}{' '}
                    {item.message_count === 1
                      ? 'wiadomość'
                      : item.message_count >= 2 && item.message_count <= 4
                        ? 'wiadomości'
                        : 'wiadomości'}
                  </p>
                  {item.last_message_preview && (
                    <p className="history-card-preview">{item.last_message_preview}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
