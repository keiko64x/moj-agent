'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CSSProperties } from 'react';

const markdownStyles: CSSProperties = {
  lineHeight: 1.6,
  color: '#f1f5f9',
};

const SECTION_STYLES: Record<string, CSSProperties> = {
  thought: {
    background: '#1a1a3a',
    border: '1px solid #3b82f6',
    borderRadius: '12px',
    padding: '12px 14px',
    margin: '12px 0',
  },
  observe: {
    background: '#2a1a0a',
    border: '1px solid #f97316',
    borderRadius: '12px',
    padding: '12px 14px',
    margin: '12px 0',
  },
  result: {
    background: '#0a2a0a',
    border: '1px solid #22c55e',
    borderRadius: '12px',
    padding: '12px 14px',
    margin: '12px 0',
  },
};

function getSectionType(header: string): keyof typeof SECTION_STYLES | null {
  if (/myślę/i.test(header)) return 'thought';
  if (/obserwuję/i.test(header)) return 'observe';
  if (/wynik/i.test(header)) return 'result';
  return null;
}

function getReactProgress(content: string) {
  const thoughtSteps = (content.match(/###\s*🧠/g) ?? []).length;
  const hasResult = /###\s*✅/.test(content);
  const totalSteps = Math.min(Math.max(thoughtSteps, hasResult ? thoughtSteps : 1), 5);
  const currentStep = hasResult ? totalSteps : Math.max(thoughtSteps, 1);

  return { currentStep, totalSteps: Math.max(totalSteps, currentStep) };
}

function splitReactSections(content: string) {
  const parts = content.split(/(?=###\s)/g).filter(Boolean);

  if (parts.length <= 1 && !content.startsWith('###')) {
    return [{ type: null as keyof typeof SECTION_STYLES | null, body: content }];
  }

  return parts.map((part) => {
    const headerMatch = part.match(/^###\s*(.+?)(?:\r?\n|$)/);
    const header = headerMatch?.[1]?.trim() ?? '';
    return {
      type: getSectionType(header),
      body: part.trim(),
    };
  });
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h3: ({ children }) => (
          <h3 style={{ fontSize: '1rem', margin: '0 0 8px', color: '#f1f5f9' }}>
            {children}
          </h3>
        ),
        p: ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>,
        ul: ({ children }) => (
          <ul style={{ margin: '0 0 10px', paddingLeft: '20px' }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '0 0 10px', paddingLeft: '20px' }}>{children}</ol>
        ),
        strong: ({ children }) => <strong>{children}</strong>,
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function ReactMarkdownMessage({ content }: { content: string }) {
  const { currentStep, totalSteps } = getReactProgress(content);
  const showProgress = content.includes('🧠');
  const sections = splitReactSections(content);

  return (
    <div style={markdownStyles} className="markdown-body react-markdown">
      {showProgress && (
        <div style={progressStyles.wrapper}>
          <div style={progressStyles.label}>
            Krok {currentStep} z {totalSteps}
          </div>
          <div style={progressStyles.track}>
            <div
              style={{
                ...progressStyles.fill,
                width: `${(currentStep / totalSteps) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {sections.map((section, index) => {
        const style = section.type ? SECTION_STYLES[section.type] : undefined;
        const isLast = index < sections.length - 1;

        return (
          <div key={`${section.type ?? 'plain'}-${index}`}>
            {style ? (
              <div style={style}>
                <MarkdownBlock content={section.body} />
              </div>
            ) : (
              <MarkdownBlock content={section.body} />
            )}
            {isLast && section.type && (
              <div
                style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, #3b3b5c, transparent)',
                  margin: '4px 0 12px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const progressStyles: Record<string, CSSProperties> = {
  wrapper: {
    marginBottom: '16px',
    padding: '10px 12px',
    background: 'rgba(15, 15, 26, 0.8)',
    border: '1px solid #2e2e4a',
    borderRadius: '10px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '8px',
  },
  track: {
    height: '6px',
    background: '#2e2e4a',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    borderRadius: '999px',
    transition: 'width 0.3s ease',
  },
};
