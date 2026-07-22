'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CSSProperties } from 'react';

const markdownStyles: CSSProperties = {
  lineHeight: 1.6,
  color: '#f1f5f9',
};

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div style={markdownStyles} className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '12px 0' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem',
                  background: '#16162a',
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
                padding: '8px',
                background: 'rgba(139, 92, 246, 0.2)',
                color: '#c4b5fd',
                textAlign: 'left',
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                border: '1px solid #2e2e4a',
                padding: '8px',
                verticalAlign: 'top',
                background: '#16162a',
              }}
            >
              {children}
            </td>
          ),
          p: ({ children }) => (
            <p style={{ margin: '0 0 10px' }}>{children}</p>
          ),
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
          h1: ({ children }) => (
            <h1 style={{ fontSize: '1.2rem', margin: '0 0 10px', color: '#c4b5fd' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 10px', color: '#c4b5fd' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: '1rem', margin: '0 0 8px', color: '#06b6d4' }}>
              {children}
            </h3>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || 'Obraz'}
              style={{
                maxWidth: '100%',
                borderRadius: '12px',
                border: '1px solid #2e2e4a',
                margin: '10px 0',
              }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
