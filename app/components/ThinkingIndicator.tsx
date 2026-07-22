'use client';

import type { CSSProperties } from 'react';

type ThinkingIndicatorProps = {
  label?: string;
};

export default function ThinkingIndicator({
  label = 'Agent myśli',
}: ThinkingIndicatorProps) {
  return (
    <div style={styles.wrapper} aria-live="polite" aria-busy="true">
      <div style={styles.iconOrbit} className="thinking-orbit">
        <span style={styles.brain} className="thinking-brain">
          🧠
        </span>
      </div>
      <div style={styles.textBlock}>
        <span style={styles.label}>{label}</span>
        <span style={styles.dots} className="thinking-dots" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 0',
  },
  iconOrbit: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brain: {
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  textBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
    color: '#c4b5fd',
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  label: {
    color: '#c4b5fd',
  },
  dots: {
    display: 'inline-flex',
    gap: '1px',
    color: '#06b6d4',
    fontWeight: 700,
  },
};
