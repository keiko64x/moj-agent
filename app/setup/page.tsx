'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type HealthResponse = {
  ok: boolean;
  configured: boolean;
  message: string;
  tables: Record<string, boolean>;
  errors?: string[];
};

const STEPS = [
  {
    title: 'Konto i projekt Supabase',
    body: 'Wejdź na supabase.com → Start your project → zaloguj się GitHubem → New Project (nazwa: moj-agent, region: Frankfurt). Zapisz hasło bazy.',
  },
  {
    title: 'Klucze API do .env.local',
    body: 'Settings → API → skopiuj Project URL i anon/public key. Dopisz do .env.local jako NEXT_PUBLIC_SUPABASE_URL oraz NEXT_PUBLIC_SUPABASE_ANON_KEY (nie usuwaj GOOGLE_GENERATIVE_AI_API_KEY). Zrestartuj serwer.',
  },
  {
    title: 'Tabele w bazie',
    body: 'W SQL Editor wklej plik supabase/schema.sql (Lekcja 5: conversations, messages, user_profiles). Potem supabase/pgvector.sql (Lekcja 6: documents + match_documents — wymaga Extensions → pgvector Enable).',
  },
  {
    title: 'Login i prywatność (L07 W3)',
    body: 'W SQL Editor uruchom supabase/auth-rls.sql (user_id + RLS na rozmowach/profilu). Potem supabase/shared-knowledge.sql — wspólna baza wiedzy dla wszystkich zalogowanych. Auth → Email: wyłącz Confirm email na czas warsztatu.',
  },
  {
    title: 'Jeśli błąd „row-level security”',
    body: 'Po auth-rls.sql RLS jest WŁĄCZONE celowo — niezalogowany nie czyta danych. Zaloguj się. Stary fix-rls.sql wyłączał RLS — nie uruchamiaj go po auth-rls.sql.',
  },
  {
    title: 'Weryfikacja',
    body: 'Zaloguj się → napisz na /chat → /history pokazuje rozmowę. Wyloguj → drugie konto → historia pusta. „Sprawdź połączenie” poniżej potwierdza tabele.',
  },
];

export default function SetupPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supabase/health', { cache: 'no-store' });
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
    } catch {
      setHealth({
        ok: false,
        configured: false,
        message: 'Nie udało się sprawdzić API health',
        tables: {},
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <main className="setup-main">
      <div className="setup-header">
        <p className="setup-eyebrow">Lekcja 5 · Warsztat 1</p>
        <h1 className="setup-title">🗄️ Supabase — baza w chmurze</h1>
        <p className="setup-subtitle">
          Agent przestaje być amnezjakiem: rozmowy i profil użytkownika będą żyły poza RAM
          przeglądarki.
        </p>
      </div>

      <section
        className={`setup-status ${
          health?.ok ? 'setup-status-ok' : health?.configured ? 'setup-status-warn' : 'setup-status-off'
        }`}
      >
        <div className="setup-status-top">
          <strong>
            {health?.ok
              ? '✅ Supabase gotowy'
              : health?.configured
                ? '⚠️ Klucze OK, tabele niekompletne'
                : '⏳ Brak konfiguracji'}
          </strong>
          <button type="button" className="setup-check-btn" onClick={() => void check()} disabled={loading}>
            {loading ? 'Sprawdzam…' : 'Sprawdź połączenie'}
          </button>
        </div>
        <p className="setup-status-msg">{health?.message ?? 'Ładowanie…'}</p>
        {health?.tables && Object.keys(health.tables).length > 0 && (
          <ul className="setup-table-list">
            {Object.entries(health.tables).map(([name, ok]) => (
              <li key={name} className={ok ? 'ok' : 'bad'}>
                {ok ? '✓' : '✗'} {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ol className="setup-steps">
        {STEPS.map((step, i) => (
          <li key={step.title} className="setup-step">
            <span className="setup-step-num">{i + 1}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="setup-code">
        <h2>.env.local — dodaj te linie</h2>
        <pre>{`NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...`}</pre>
        <h2>SQL (skrót)</h2>
        <p>
          Pełny skrypt: <code>supabase/schema.sql</code> w katalogu projektu — wklej do SQL Editor w
          Supabase.
        </p>
      </section>

      <p className="setup-footer">
        Po zielonym statusie wróć do <Link href="/">Dashboard</Link> lub{' '}
        <Link href="/chat">Chat</Link> — kolejne warsztaty (W2–W4) podłączą zapis historii i profil.
      </p>
    </main>
  );
}
