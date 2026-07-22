'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  type KnowledgeDocSummary,
} from '@/app/lib/knowledge';
import { isSupabaseConfigured } from '@/app/lib/supabase';

const SAMPLE_CENNIK = `CENNIK USŁUG 2026

Pakiet Basic: 99 zł/miesiąc
- 5 użytkowników
- 10 GB miejsca
- Wsparcie email

Pakiet Premium: 299 zł/miesiąc
- 25 użytkowników
- 100 GB miejsca
- Wsparcie email + telefon
- Priorytetowa obsługa

Pakiet VIP: 599 zł/miesiąc
- Nielimitowani użytkownicy
- 1 TB miejsca
- Wsparcie 24/7
- Dedykowany opiekun
- Szkolenie wdrożeniowe

Wszystkie pakiety z 14-dniowym okresem próbnym.
Faktura VAT wystawiana automatycznie.
Rezygnacja możliwa w dowolnym momencie.`;

const SAMPLE_FAQ = `FAQ — Subskrypcja

Q: Jak mogę anulować subskrypcję?
A: Wyślij email na support@firma.pl lub anuluj w panelu konta. Rezygnacja możliwa w dowolnym momencie.

Q: Czy jest okres próbny?
A: Tak — 14 dni na każdym pakiecie.

Q: Czy wystawiacie fakturę VAT?
A: Tak, faktura VAT jest wystawiana automatycznie.`;

const SAMPLE_REGULAMIN = `§1. Postanowienia ogólne
1.1 Niniejszy regulamin określa zasady korzystania z usługi.
1.2 Korzystanie z pakietów oznacza akceptację regulaminu.
1.3 Rezygnacja możliwa w dowolnym momencie bez dodatkowych opłat.`;

type StreamEvent =
  | { type: 'start'; total: number }
  | { type: 'progress'; current: number; total: number; message: string }
  | { type: 'done'; success: true; chunks_saved: number }
  | { type: 'error'; error: string };

export default function UploadPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [docs, setDocs] = useState<KnowledgeDocSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(
    null,
  );
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deletingTitle, setDeletingTitle] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Brak konfiguracji Supabase. Uzupełnij klucze w /setup.');
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      const list = await listKnowledgeDocuments();
      setDocs(list);
      setError('');
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — upewnij się, że uruchomiłeś supabase/pgvector.sql w SQL Editor.`
          : 'Nie udało się pobrać listy dokumentów',
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  function applySample(kind: 'cennik' | 'faq' | 'regulamin') {
    if (kind === 'cennik') {
      setTitle('Cennik 2026');
      setContent(SAMPLE_CENNIK);
    } else if (kind === 'faq') {
      setTitle('FAQ');
      setContent(SAMPLE_FAQ);
    } else {
      setTitle('Regulamin');
      setContent(SAMPLE_REGULAMIN);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (uploading) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      setError('Podaj tytuł i treść dokumentu.');
      return;
    }

    setUploading(true);
    setError('');
    setStatus('');
    setProgress({ current: 0, total: 0, message: 'Startuję…' });

    try {
      const response = await fetch('/api/upload-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, content: trimmedContent }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Błąd HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'start') {
            setProgress({
              current: 0,
              total: event.total,
              message: `Przygotowuję ${event.total} fragmentów…`,
            });
          } else if (event.type === 'progress') {
            setProgress({
              current: event.current,
              total: event.total,
              message: event.message,
            });
          } else if (event.type === 'done') {
            setStatus(`✅ Zapisano ${event.chunks_saved} fragmentów!`);
            setProgress(null);
            setContent('');
            await loadDocs();
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }
      }
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać dokumentu');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docTitle: string) {
    const ok = window.confirm(`Usunąć dokument „${docTitle}” i wszystkie jego fragmenty?`);
    if (!ok) return;
    setDeletingTitle(docTitle);
    const success = await deleteKnowledgeDocument(docTitle);
    setDeletingTitle(null);
    if (!success) {
      setError('Nie udało się usunąć dokumentu');
      return;
    }
    setDocs((prev) => prev.filter((d) => d.title !== docTitle));
    setStatus(`🗑️ Usunięto „${docTitle}”`);
  }

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <main className="upload-main">
      <header className="upload-header">
        <p className="upload-eyebrow">Lekcja 6 · Warsztat 2</p>
        <h1 className="upload-title">📚 Baza wiedzy</h1>
        <p className="upload-subtitle">Wklej tekst — agent będzie z niego korzystał</p>
      </header>

      {!isSupabaseConfigured() && (
        <p className="upload-error">
          Brak kluczy Supabase.{' '}
          <Link href="/setup">Przejdź do /setup</Link>
        </p>
      )}

      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="upload-label" htmlFor="doc-title">
          Tytuł dokumentu
        </label>
        <input
          id="doc-title"
          className="upload-input"
          type="text"
          placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={uploading}
          required
        />

        <label className="upload-label" htmlFor="doc-content">
          Treść dokumentu
        </label>
        <textarea
          id="doc-content"
          className="upload-textarea"
          placeholder="Wklej tutaj treść dokumentu..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={uploading}
          required
        />

        <div className="upload-samples">
          <span className="upload-samples-label">Podpowiedzi:</span>
          <button type="button" className="upload-sample-btn" onClick={() => applySample('cennik')} disabled={uploading}>
            Cennik
          </button>
          <button type="button" className="upload-sample-btn" onClick={() => applySample('faq')} disabled={uploading}>
            FAQ
          </button>
          <button
            type="button"
            className="upload-sample-btn"
            onClick={() => applySample('regulamin')}
            disabled={uploading}
          >
            Regulamin
          </button>
        </div>

        <button type="submit" className="upload-submit" disabled={uploading || !title.trim() || !content.trim()}>
          {uploading ? '⏳ Zapisuję…' : '📤 Zapisz w bazie wiedzy'}
        </button>

        {progress && (
          <div className="upload-progress" aria-live="polite">
            <div className="upload-progress-bar">
              <div className="upload-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="upload-progress-text">{progress.message}</p>
          </div>
        )}

        {status && <p className="upload-success">{status}</p>}
        {error && <p className="upload-error">{error}</p>}
      </form>

      <section className="upload-list-section">
        <div className="upload-list-header">
          <h2 className="upload-list-title">Zapisane dokumenty</h2>
          <button type="button" className="upload-refresh" onClick={() => void loadDocs()} disabled={loadingList}>
            🔄 Odśwież
          </button>
        </div>

        {loadingList ? (
          <p className="upload-muted">Ładuję listę…</p>
        ) : docs.length === 0 ? (
          <p className="upload-empty">Brak dokumentów. Wklej cennik lub FAQ powyżej.</p>
        ) : (
          <ul className="upload-doc-list">
            {docs.map((doc) => (
              <li key={doc.title} className="upload-doc-card">
                <div>
                  <h3 className="upload-doc-title">{doc.title}</h3>
                  <p className="upload-doc-meta">
                    {doc.chunk_count} {doc.chunk_count === 1 ? 'fragment' : 'fragmentów'} ·{' '}
                    {new Date(doc.created_at).toLocaleString('pl-PL')}
                  </p>
                </div>
                <button
                  type="button"
                  className="upload-delete-btn"
                  disabled={deletingTitle === doc.title}
                  onClick={() => void handleDelete(doc.title)}
                >
                  {deletingTitle === doc.title ? '…' : '🗑️ Usuń'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
