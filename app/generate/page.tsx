'use client';

import { FormEvent, useState, type CSSProperties } from 'react';

const EXAMPLES = [
  'Minimalistyczne logo kawiarni w stylu japońskim',
  'Post na Instagram: kawa latte art, ciepłe światło, widok z góry',
  'Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design',
  'Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design',
  'Infografika: 5 kroków do produktywności, pastelowe kolory',
  'Zdjęcie produktowe: elegancki zegarek na ciemnym tle',
];

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');

  async function generateImage(text: string) {
    setLoading(true);
    setError('');
    setImage(null);
    setComment('');
    setModel('');

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się wygenerować obrazu');
      }

      setImage(data.image);
      setComment(data.text);
      setModel(data.model ?? '');
      setLastPrompt(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || loading) return;
    generateImage(text);
  }

  function handleDownload() {
    if (!image) return;

    const link = document.createElement('a');
    link.href = image;
    link.download = 'ai-generated.png';
    link.click();
  }

  function handleRegenerate() {
    if (!lastPrompt || loading) return;
    generateImage(lastPrompt);
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.title}>🎨 Generator grafik AI</h1>
          <p style={styles.subtitle}>
            Opisz co chcesz — AI stworzy obraz w kilka sekund
          </p>
        </header>

        <div style={styles.examples}>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              style={styles.exampleButton}
              disabled={loading}
            >
              {example}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Opisz obraz który chcesz wygenerować..."
            style={styles.textarea}
            rows={4}
            disabled={loading}
          />
          <button
            type="submit"
            style={{
              ...styles.generateButton,
              ...(prompt.trim() && !loading ? {} : styles.generateButtonDisabled),
            }}
            disabled={!prompt.trim() || loading}
          >
            🎨 Generuj
          </button>
        </form>

        {loading && (
          <div style={styles.loadingBox} className="pulse-loading">
            <div style={styles.loadingPlaceholder} />
            <p style={styles.loadingText}>Generuję... (zwykle 5–30 sekund)</p>
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <p>{error}</p>
            {lastPrompt && (
              <button
                type="button"
                onClick={handleRegenerate}
                style={styles.retryButton}
                disabled={loading}
              >
                🔄 Spróbuj ponownie
              </button>
            )}
          </div>
        )}

        {image && !loading && (
          <div style={styles.result}>
            <img src={image} alt="Wygenerowany obraz" style={styles.image} />
            {model && (
              <p style={styles.modelBadge}>
                {model.startsWith('pollinations')
                  ? '⚡ Zapasowy silnik (Pollinations)'
                  : `✨ Google Gemini (${model})`}
              </p>
            )}
            {comment && <p style={styles.comment}>{comment}</p>}
            <div style={styles.resultActions}>
              <button type="button" onClick={handleDownload} style={styles.actionButton}>
                💾 Pobierz
              </button>
              <button type="button" onClick={handleRegenerate} style={styles.actionButton}>
                🔄 Ponownie
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '24px 16px 32px',
    minHeight: 'calc(100vh - 110px)',
  },
  card: {
    background: '#1e1e35',
    borderRadius: '20px',
    border: '1px solid #2e2e4a',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
    padding: '24px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #2e2e4a',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#f1f5f9',
  },
  subtitle: {
    marginTop: '8px',
    fontSize: '0.95rem',
    color: '#94a3b8',
  },
  examples: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  exampleButton: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#06b6d4',
    fontSize: '0.82rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  textarea: {
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#f1f5f9',
    fontSize: '1rem',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  generateButton: {
    padding: '14px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.35)',
  },
  generateButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  loadingBox: {
    textAlign: 'center',
    padding: '24px',
    marginBottom: '16px',
  },
  loadingPlaceholder: {
    width: '100%',
    maxWidth: '400px',
    height: '300px',
    margin: '0 auto 16px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
    border: '2px dashed #3b3b5c',
  },
  loadingText: {
    color: '#c4b5fd',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  error: {
    color: '#f87171',
    background: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid #f87171',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  retryButton: {
    marginTop: '10px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#06b6d4',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  result: {
    textAlign: 'center',
    paddingTop: '8px',
  },
  image: {
    maxWidth: '100%',
    borderRadius: '16px',
    border: '1px solid #2e2e4a',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  },
  modelBadge: {
    marginTop: '12px',
    color: '#c4b5fd',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  comment: {
    marginTop: '8px',
    color: '#94a3b8',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  resultActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '16px',
    flexWrap: 'wrap',
  },
  actionButton: {
    padding: '10px 20px',
    borderRadius: '12px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#c4b5fd',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
