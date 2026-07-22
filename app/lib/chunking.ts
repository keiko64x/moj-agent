/**
 * Dzieli tekst na fragmenty ~chunkSize znaków z overlapem.
 * Najpierw zdania (po . ! ? i nowe linie), potem sklejanie.
 */
export function splitIntoChunks(
  text: string,
  chunkSize = 500,
  overlap = 50,
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [normalized];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      const overlapText =
        overlap > 0 && current.length > overlap
          ? current.slice(-overlap)
          : current;
      current = `${overlapText} ${sentence}`.trim();
      if (current.length > chunkSize) {
        // Bardzo długie zdanie — tnij na sztywno
        let rest = sentence;
        while (rest.length > chunkSize) {
          chunks.push(rest.slice(0, chunkSize));
          rest = rest.slice(chunkSize - overlap);
        }
        current = rest;
      }
    } else {
      let rest = sentence;
      while (rest.length > chunkSize) {
        chunks.push(rest.slice(0, chunkSize));
        rest = rest.slice(chunkSize - overlap);
      }
      current = rest;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
