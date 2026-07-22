'use client';

import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import type { CSSProperties } from 'react';
import {
  formatToolArgs,
  getGenerateImageFromParts,
  getToolEmoji,
  getToolParts,
  summarizeToolOutput,
} from '../lib/tool-utils';

type ToolTimelineProps = {
  parts: UIMessage['parts'];
  isActive?: boolean;
};

export function ToolTimeline({ parts, isActive = false }: ToolTimelineProps) {
  const toolParts = getToolParts(parts);

  if (toolParts.length === 0 && !isActive) return null;

  return (
    <div style={styles.timeline}>
      <div style={styles.timelineHeader}>
        🤖 {isActive ? 'Agent wykonuje zadanie...' : 'Użyte narzędzia'}
      </div>

      {toolParts.map((part, index) => {
        if (!isToolUIPart(part)) return null;

        const toolName = getToolName(part);
        const emoji = getToolEmoji(toolName);
        const isLoading =
          part.state === 'input-streaming' || part.state === 'input-available';
        const isError = part.state === 'output-error';
        const image =
          toolName === 'generateImage' &&
          part.state === 'output-available' &&
          typeof part.output === 'object' &&
          part.output !== null &&
          'image' in part.output
            ? (part.output as { image: string }).image
            : null;

        return (
          <div
            key={part.toolCallId}
            style={{
              ...styles.step,
              ...(isLoading ? styles.stepLoading : {}),
              ...(isError ? styles.stepError : {}),
            }}
          >
            <div style={styles.stepTitle}>
              {index + 1}. {emoji} {toolName}
              {formatToolArgs(toolName, part.input)}
            </div>
            {isLoading && <div style={styles.stepResult}>⏳ Wykonuję...</div>}
            {part.state === 'output-available' && (
              <>
                <div style={styles.stepResult}>
                  → {summarizeToolOutput(toolName, part.output)}
                </div>
                {image && (
                  <img src={image} alt="Wygenerowany obraz" style={styles.stepImage} />
                )}
              </>
            )}
            {isError && (
              <div style={styles.stepResult}>❌ {part.errorText}</div>
            )}
          </div>
        );
      })}

      {isActive && toolParts.length === 0 && (
        <div style={styles.stepLoading}>⏳ Planuję kolejne kroki...</div>
      )}
    </div>
  );
}

export function GeneratedImageBlock({ parts }: { parts: UIMessage['parts'] }) {
  const image = getGenerateImageFromParts(parts);
  if (!image) return null;

  return <PostImagePreview image={image} label="🎨 Wygenerowany obraz" downloadName="ai-generated.png" />;
}

export function AttachedPostImageBlock({
  image,
  label = '📎 Obraz do posta',
}: {
  image: string;
  label?: string;
}) {
  return <PostImagePreview image={image} label={label} downloadName="post-image.png" />;
}

function PostImagePreview({
  image,
  label,
  downloadName,
}: {
  image: string;
  label: string;
  downloadName: string;
}) {
  function handleDownload() {
    const link = document.createElement('a');
    link.href = image;
    link.download = downloadName;
    link.click();
  }

  return (
    <div style={styles.generatedBlock}>
      <p style={styles.postImageLabel}>{label}</p>
      <img src={image} alt={label} style={styles.generatedImage} />
      <button type="button" onClick={handleDownload} style={styles.downloadButton}>
        💾 Pobierz
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  timeline: {
    marginBottom: '12px',
    padding: '12px 14px',
    background: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid #3b3b5c',
    borderRadius: '12px',
  },
  timelineHeader: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#c4b5fd',
    marginBottom: '10px',
  },
  step: {
    padding: '8px 10px',
    marginBottom: '6px',
    background: 'rgba(15, 15, 26, 0.6)',
    borderRadius: '8px',
    border: '1px solid #2e2e4a',
  },
  stepLoading: {
    border: '1px solid #8b5cf6',
    animation: 'pulse-glow 1.5s ease-in-out infinite',
  },
  stepError: {
    border: '1px solid #f87171',
  },
  stepTitle: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: '4px',
  },
  stepResult: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    lineHeight: 1.4,
  },
  stepImage: {
    marginTop: '8px',
    maxWidth: '200px',
    borderRadius: '8px',
    border: '1px solid #2e2e4a',
  },
  generatedBlock: {
    marginTop: '12px',
    textAlign: 'center',
    padding: '12px',
    background: 'rgba(6, 182, 212, 0.06)',
    border: '1px solid #2e2e4a',
    borderRadius: '12px',
  },
  postImageLabel: {
    margin: '0 0 10px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#06b6d4',
    textAlign: 'left',
  },
  generatedImage: {
    maxWidth: '100%',
    borderRadius: '12px',
    border: '1px solid #2e2e4a',
  },
  downloadButton: {
    marginTop: '8px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#06b6d4',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
};
