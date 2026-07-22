/**
 * Wyciąga linię cytowania 📎 Źródło(a): ... z odpowiedzi agenta.
 */
export function splitKnowledgeCitation(text: string): {
  body: string;
  citationLabel: string | null;
  citationTitles: string[];
} {
  const re = /\n?\s*📎\s*Źródł[ao]:\s*(.+)\s*$/i;
  const match = text.match(re);
  if (!match) {
    return { body: text, citationLabel: null, citationTitles: [] };
  }

  const citationLabel = match[1].trim();
  const citationTitles = citationLabel
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    body: text.replace(re, '').trimEnd(),
    citationLabel,
    citationTitles,
  };
}
