'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CSSProperties, ReactNode } from 'react';

type SectionType =
  | 'hero'
  | 'summary'
  | 'weather'
  | 'sleeves'
  | 'gastro'
  | 'trees'
  | 'budget'
  | 'holidays'
  | 'attractions'
  | 'checklist'
  | 'recommendation'
  | 'default';

const CARD_STYLES: Record<SectionType, CSSProperties> = {
  hero: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f766e 100%)',
    border: '1px solid #06b6d4',
    borderRadius: '16px',
    padding: '16px 18px',
    margin: '0 0 14px',
  },
  summary: {
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid #8b5cf6',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  weather: {
    background: 'linear-gradient(135deg, #1a1a3a 0%, #1e3a5f 100%)',
    border: '1px solid #3b82f6',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  sleeves: {
    background: 'linear-gradient(135deg, #422006 0%, #9a3412 55%, #1e3a5f 100%)',
    border: '1px solid #fb923c',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  gastro: {
    background: 'linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)',
    border: '1px solid #4ade80',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  trees: {
    background: 'linear-gradient(135deg, #1a2e05 0%, #3f6212 60%, #1c1917 100%)',
    border: '1px solid #a3e635',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  budget: {
    background: 'linear-gradient(135deg, #1a2a0a 0%, #14532d 100%)',
    border: '1px solid #22c55e',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  holidays: {
    background: 'linear-gradient(135deg, #2a1a0a 0%, #431407 100%)',
    border: '1px solid #f97316',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  attractions: {
    background: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid #0891b2',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  checklist: {
    background: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid #16a34a',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  recommendation: {
    background: 'linear-gradient(135deg, #422006 0%, #713f12 100%)',
    border: '2px solid #fbbf24',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
  default: {
    background: '#16162a',
    border: '1px solid #2e2e4a',
    borderRadius: '14px',
    padding: '14px 16px',
    margin: '0 0 12px',
  },
};

const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Plan podróży',
  summary: 'Podsumowanie',
  weather: 'Pogoda',
  sleeves: 'Alert: Krótki Rękawek',
  gastro: 'Zielone Gastro',
  trees: 'Prastare Olbrzymy',
  budget: 'Waluta & budżet',
  holidays: 'Święta & dni wolne',
  attractions: 'Atrakcje',
  checklist: 'Checklist',
  recommendation: 'Rekomendacja',
  default: 'Szczegóły',
};

const SECTION_ICONS: Record<SectionType, string> = {
  hero: '🗺️',
  summary: '📋',
  weather: '🌤️',
  sleeves: '👕',
  gastro: '🌱',
  trees: '🌳',
  budget: '💰',
  holidays: '📅',
  attractions: '🏛️',
  checklist: '✅',
  recommendation: '🏆',
  default: '📌',
};

function detectSectionType(header: string): SectionType {
  if (/plan podróży/i.test(header)) return 'hero';
  if (/podsumowanie/i.test(header)) return 'summary';
  if (/krótki rękawek|krotki rekaw|alert.*rękawek/i.test(header)) return 'sleeves';
  if (/zielone gastro|wege|wegań|vegan|vegetar/i.test(header)) return 'gastro';
  if (/prastare|olbrzym|drzew/i.test(header)) return 'trees';
  if (/pogod/i.test(header)) return 'weather';
  if (/budżet|walut/i.test(header)) return 'budget';
  if (/ważne daty|święt|dni wolne/i.test(header)) return 'holidays';
  if (/zobaczyć|atrakcj/i.test(header)) return 'attractions';
  if (/checklist|spakować|przed wyjazdem/i.test(header)) return 'checklist';
  if (/rekomendac/i.test(header)) return 'recommendation';
  return 'default';
}

function splitSections(content: string) {
  const parts = content.split(/(?=#{2,3}\s)/g).filter(Boolean);

  if (parts.length <= 1 && !/^#{2,3}\s/.test(content.trim())) {
    return [{ type: 'default' as SectionType, body: content }];
  }

  return parts.map((part) => {
    const headerMatch = part.match(/^#{2,3}\s*(.+?)(?:\r?\n|$)/);
    const header = headerMatch?.[1]?.trim() ?? '';
    const type = detectSectionType(header);
    return { type, header, body: part.trim() };
  });
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 10px', color: '#f1f5f9' }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: '1rem', margin: '0 0 8px', color: '#c4b5fd' }}>
            {children}
          </h3>
        ),
        p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.55 }}>{children}</p>,
        ul: ({ children }) => (
          <ul style={{ margin: '0 0 8px', paddingLeft: '20px' }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '0 0 8px', paddingLeft: '20px' }}>{children}</ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
        strong: ({ children }) => <strong style={{ color: '#e2e8f0' }}>{children}</strong>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#06b6d4', textDecoration: 'underline' }}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '10px 0' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.88rem',
                background: 'rgba(15, 15, 26, 0.6)',
              }}
            >
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th
            style={{
              border: '1px solid #3b3b5c',
              padding: '10px 12px',
              background: 'rgba(139, 92, 246, 0.25)',
              color: '#c4b5fd',
              textAlign: 'left',
              fontWeight: 700,
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            style={{
              border: '1px solid #2e2e4a',
              padding: '10px 12px',
              verticalAlign: 'top',
              color: '#e2e8f0',
            }}
          >
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function SectionCard({
  type,
  children,
}: {
  type: SectionType;
  children: ReactNode;
}) {
  const icon = SECTION_ICONS[type];
  const isHero = type === 'hero';

  return (
    <div style={CARD_STYLES[type]}>
      {!isHero && type !== 'default' && (
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '8px',
          }}
        >
          {icon} {SECTION_LABELS[type]}
        </div>
      )}
      {children}
    </div>
  );
}

export default function TravelMarkdownMessage({ content }: { content: string }) {
  const sections = splitSections(content);
  const hasTravelPlan =
    /plan podróży|🗺️|zielone gastro|krótki rękawek|prastare olbrzym/i.test(content);

  if (!hasTravelPlan) {
    return (
      <div style={{ lineHeight: 1.6, color: '#f1f5f9' }}>
        <MarkdownContent content={content} />
      </div>
    );
  }

  return (
    <div style={{ lineHeight: 1.6, color: '#f1f5f9' }} className="travel-markdown">
      {sections.map((section, index) => (
        <SectionCard key={`${section.type}-${index}`} type={section.type}>
          <MarkdownContent content={section.body} />
        </SectionCard>
      ))}
    </div>
  );
}
