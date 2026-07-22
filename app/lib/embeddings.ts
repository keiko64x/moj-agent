import { getPrimaryGoogleApiKey } from '@/app/lib/google-api-keys';

/** text-embedding-004 został wycofany — używamy gemini-embedding-001 (768 dim). */
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Embedding tekstu przez Google Generative AI.
 * Model: gemini-embedding-001, wymuszamy 768 wymiarów (jak tabela documents).
 */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' = 'RETRIEVAL_DOCUMENT',
): Promise<number[]> {
  const apiKey = getPrimaryGoogleApiKey();
  if (!apiKey) {
    throw new Error('Brak GOOGLE_GENERATIVE_AI_API_KEY w .env.local');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Pusty tekst — nie mogę wygenerować embeddingu');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: trimmed }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Embedding API ${response.status}: ${body.slice(0, 280) || response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    embedding?: { values?: number[] };
  };

  const values = data.embedding?.values;
  if (!values?.length) {
    throw new Error('API nie zwróciło wektora embeddingu');
  }

  return values;
}
