'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useAuth } from '@/app/lib/auth';
import TechLogo from './TechLogo';
import { techNavLinkStyle } from './TechLogo';

const NAV_LINKS = [
  { href: '/', label: '🏠 Dashboard', exact: true },
  { href: '/chat', label: '💬 Chat' },
  { href: '/history', label: '📜 Historia', featured: true },
  { href: '/upload', label: '📚 Baza wiedzy', featured: true },
  { href: '/knowledge', label: '🔎 Podgląd RAG', featured: true },
  { href: '/setup', label: '🗄️ Supabase', featured: true },
  { href: '/think', label: '🧠 Myślenie' },
  { href: '/fewshot', label: '📚 Słownik AI' },
  { href: '/format', label: '📐 Formater' },
  { href: '/search', label: '🌐 Szukaj' },
  { href: '/generate', label: '🎨 Grafiki' },
  { href: '/vision', label: '👁️ Vision' },
  { href: '/agent', label: '🤖 Agent', featured: true },
  { href: '/react', label: '🔄 ReAct', featured: true },
  { href: '/travel', label: '✈️ Podróże', featured: true },
];

function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  active,
  featured,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  featured?: boolean;
  onNavigate?: () => void;
}) {
  const style: CSSProperties = featured
    ? {
        ...techNavLinkStyle(active),
        background: active
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(6, 182, 212, 0.25) 100%)'
          : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
        border: '2px solid #8b5cf6',
        fontWeight: 700,
      }
    : techNavLinkStyle(active);

  return (
    <Link href={href} style={style} onClick={onNavigate}>
      {label}
    </Link>
  );
}

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, configured } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } finally {
      setSigningOut(false);
      setMobileOpen(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
        <div className="app-sidebar-header">
          <Link href="/" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none' }}>
            <TechLogo compact />
          </Link>
        </div>

        <nav className="app-sidebar-nav">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              featured={link.featured}
              active={isActivePath(pathname, link.href, link.exact)}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {configured && user && (
          <div className="app-sidebar-auth">
            <p className="app-sidebar-user" title={user.email ?? user.id}>
              {user.email ?? 'Zalogowany'}
            </p>
            <button
              type="button"
              className="app-sidebar-logout"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? 'Wylogowuję…' : 'Wyloguj'}
            </button>
          </div>
        )}
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Zamknij menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-content">
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-hamburger"
            aria-label="Otwórz menu"
            onClick={() => setMobileOpen((open) => !open)}
          >
            ☰
          </button>
          <span className="app-mobile-title">Agentosław Reaktowski</span>
        </header>

        <div className="app-banner">
          🤖 Agentosław Reaktowski — Twój sztuczny inteligent za jeden uśmiech. Daj mi misje!
        </div>

        {children}
      </div>
    </div>
  );
}
