'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  formatConversationWhen,
  formatMessageTime,
  getConversationById,
  getMessagesForConversation,
} from '@/app/lib/conversations';
import type { ConversationRow, MessageRow } from '@/app/lib/supabase-types';
import { isSupabaseConfigured } from '@/app/lib/supabase';

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    if (!isSupabaseConfigured()) {
      setError('Brak konfiguracji Supabase.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const conv = await getConversationById(id);
      if (cancelled) return;
      if (!conv) {
        setError('Nie znaleziono tej rozmowy.');
        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }
      const rows = await getMessagesForConversation(id);
      if (cancelled) return;
      setConversation(conv);
      setMessages(rows);
      setError('');
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="history-main history-detail">
      <div className="history-detail-nav">
        <Link href="/history" className="history-back-link">
          ← Wróć do listy
        </Link>
        {conversation && (
          <Link href={`/chat?c=${conversation.id}`} className="history-primary-btn">
            🔄 Kontynuuj rozmowę
          </Link>
        )}
      </div>

      {loading ? (
        <p className="history-muted">Ładowanie rozmowy…</p>
      ) : error ? (
        <p className="history-error">{error}</p>
      ) : conversation ? (
        <>
          <header className="history-header">
            <h1 className="history-title">{conversation.title?.trim() || 'Bez tytułu'}</h1>
            <p className="history-subtitle">
              Ostatnia aktywność: {formatConversationWhen(conversation.updated_at)}
              {' · '}
              {messages.length} wiadomości
            </p>
          </header>

          <div className="history-thread">
            {messages.length === 0 ? (
              <p className="history-muted">Ta rozmowa nie ma jeszcze wiadomości.</p>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <article
                    key={message.id}
                    className={`history-bubble ${isUser ? 'history-bubble-user' : 'history-bubble-assistant'}`}
                  >
                    <header className="history-bubble-meta">
                      <span>{isUser ? 'Ty' : 'Agent'}</span>
                      <time dateTime={message.created_at}>
                        {formatMessageTime(message.created_at)}
                      </time>
                    </header>
                    <p className="history-bubble-text">{message.content}</p>
                  </article>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}
