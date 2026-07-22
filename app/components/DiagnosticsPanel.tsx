'use client';

import type { CSSProperties } from 'react';
import type { UIMessage } from 'ai';
import {
  collectToolErrors,
  countToolErrors,
  countToolParts,
  getToolUsageCounts,
} from '../lib/tool-utils';

type DiagnosticsPanelProps = {
  parts: UIMessage['parts'];
  isLoading: boolean;
  elapsedMs: number | null;
  maxSteps?: number;
};

function getStepBarColor(steps: number, maxSteps: number): string {
  const ratio = steps / maxSteps;
  if (ratio <= 0.6) return '#22c55e';
  if (ratio <= 0.8) return '#eab308';
  return '#ef4444';
}

function getStatus(isLoading: boolean, steps: number, maxSteps: number, errorCount: number) {
  if (isLoading) {
    return { label: 'W trakcie...', color: '#06b6d4', icon: '⏳' };
  }

  if (steps >= maxSteps) {
    return { label: '⚠️ Limit kroków', color: '#ef4444', icon: '⚠️' };
  }

  if (errorCount > 0) {
    return { label: 'Ukończone z błędami', color: '#f97316', icon: '⚠️' };
  }

  return { label: 'Zadanie ukończone', color: '#22c55e', icon: '✅' };
}

export default function DiagnosticsPanel({
  parts,
  isLoading,
  elapsedMs,
  maxSteps = 5,
}: DiagnosticsPanelProps) {
  const steps = countToolParts(parts);
  const toolCounts = getToolUsageCounts(parts);
  const errorCount = countToolErrors(parts);
  const toolErrors = collectToolErrors(parts);
  const status = getStatus(isLoading, steps, maxSteps, errorCount);
  const barColor = getStepBarColor(steps, maxSteps);
  const displaySteps = Math.min(steps, maxSteps);
  const progressPercent = maxSteps > 0 ? (displaySteps / maxSteps) * 100 : 0;

  const toolSummary = Object.entries(toolCounts)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ');

  if (steps === 0 && !isLoading) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>🛡️ Diagnostyka</div>

      <div style={styles.row}>
        <span style={styles.label}>Kroki:</span>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progressPercent}%`,
              background: barColor,
            }}
          />
        </div>
        <span style={styles.value}>
          {displaySteps}/{maxSteps}
        </span>
      </div>

      {toolSummary && (
        <div style={styles.row}>
          <span style={styles.label}>Narzędzia:</span>
          <span style={styles.value}>{toolSummary}</span>
        </div>
      )}

      <div style={styles.row}>
        <span style={styles.label}>Błędy:</span>
        <span style={{ ...styles.value, color: errorCount > 0 ? '#f87171' : '#94a3b8' }}>
          {errorCount}
        </span>
      </div>

      {elapsedMs !== null && (
        <div style={styles.row}>
          <span style={styles.label}>Czas:</span>
          <span style={styles.value}>{(elapsedMs / 1000).toFixed(1)}s</span>
        </div>
      )}

      <div style={styles.statusRow}>
        <span style={{ color: status.color, fontWeight: 700 }}>
          {status.icon} Status: {status.label}
        </span>
      </div>

      {toolErrors.length > 0 && (
        <div style={styles.errorsBlock}>
          {toolErrors.map((item, index) => (
            <div key={`${item.toolName}-${index}`} style={styles.errorAlert}>
              🔴 {item.toolName}
              {item.args} — {item.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    marginTop: '16px',
    padding: '14px 16px',
    background: 'rgba(15, 15, 26, 0.85)',
    border: '1px solid #2e2e4a',
    borderRadius: '14px',
  },
  header: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#c4b5fd',
    marginBottom: '12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
    fontSize: '0.85rem',
  },
  label: {
    color: '#94a3b8',
    minWidth: '72px',
    flexShrink: 0,
  },
  value: {
    color: '#e2e8f0',
    wordBreak: 'break-word',
  },
  progressTrack: {
    flex: 1,
    height: '8px',
    background: '#2e2e4a',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.3s ease, background 0.3s ease',
  },
  statusRow: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #2e2e4a',
    fontSize: '0.85rem',
  },
  errorsBlock: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  errorAlert: {
    padding: '8px 10px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    fontSize: '0.82rem',
    color: '#fca5a5',
    lineHeight: 1.4,
  },
};
