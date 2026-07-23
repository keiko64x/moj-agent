'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/auth';

export default function LoginPage() {
  const { signIn, signUp, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setError('Podaj email i hasło (min. 6 znaków).');
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');

    try {
      if (mode === 'login') {
        const result = await signIn(trimmedEmail, password);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.replace('/');
        return;
      }

      const result = await signUp(trimmedEmail, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirm) {
        setInfo(
          'Konto utworzone. Potwierdź email (albo w Supabase wyłącz Confirm email) i zaloguj się.',
        );
        setMode('login');
        return;
      }
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="login-main">
        <section className="login-card">
          <h1>Brak Supabase</h1>
          <p>
            Uzupełnij klucze w <Link href="/setup">/setup</Link> i uruchom{' '}
            <code>supabase/auth-rls.sql</code>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-main">
      <section className="login-card">
        <p className="login-eyebrow">Agentosław Reaktowski</p>
        <h1>{mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}</h1>
        <p className="login-subtitle">
          Każdy użytkownik widzi tylko swoje rozmowy, dokumenty i profil.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Hasło
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>

          {error && <p className="login-error">{error}</p>}
          {info && <p className="login-info">{info}</p>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy
              ? 'Chwila…'
              : mode === 'login'
                ? 'Zaloguj się'
                : 'Zarejestruj się'}
          </button>
        </form>

        <button
          type="button"
          className="login-toggle"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError('');
            setInfo('');
          }}
        >
          {mode === 'login'
            ? 'Nie masz konta? Zarejestruj się'
            : 'Masz konto? Zaloguj się'}
        </button>
      </section>
    </main>
  );
}
