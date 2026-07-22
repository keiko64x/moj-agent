'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TechLogo, { techNavLinkStyle } from './TechLogo';
import type { CSSProperties } from 'react';

const links = [
  { href: '/agent', label: '🤖 Agent', featured: true },
  { href: '/react', label: '🔄 ReAct', featured: true },
  { href: '/travel', label: '✈️ Podróże', featured: true },
  { href: '/chat', label: '💬 Chat' },
  { href: '/history', label: '📜 Historia', featured: true },
  { href: '/upload', label: '📚 Baza wiedzy', featured: true },
  { href: '/knowledge', label: '🔎 Podgląd RAG', featured: true },
  { href: '/think', label: '🧠 Myślenie' },
  { href: '/search', label: '🌐 Szukaj' },
  { href: '/generate', label: '🎨 Grafiki' },
  { href: '/vision', label: '👁️ Vision' },
  { href: '/extract', label: '📊 Analizator' },
  { href: '/format', label: '📐 Formater' },
];

function featuredNavStyle(active = false): CSSProperties {
  return {
    ...techNavLinkStyle(active),
    background: active
      ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(6, 182, 212, 0.25) 100%)'
      : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
    border: '2px solid #8b5cf6',
    color: '#f1f5f9',
    fontWeight: 700,
    boxShadow: '0 0 16px rgba(139, 92, 246, 0.3)',
  };
}

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header
      style={{
        background: '#16162a',
        borderBottom: '1px solid #2e2e4a',
        boxShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(90deg, #7c3aed 0%, #06b6d4 100%)',
          color: '#ffffff',
          textAlign: 'center',
          fontSize: '0.78rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '6px 16px',
        }}
      >
        🤖 Agentosław Reaktowski — Twój sztuczny inteligent za jeden uśmiech. Daj mi misje!
      </div>

      <nav
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/agent" style={{ textDecoration: 'none' }}>
          <TechLogo compact />
        </Link>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                style={
                  link.featured ? featuredNavStyle(isActive) : techNavLinkStyle(isActive)
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
