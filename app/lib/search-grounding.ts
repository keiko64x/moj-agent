/** Search Grounding / google_search — płatne ($14/1000). Domyślnie WYŁĄCZONE. */
export const SEARCH_GROUNDING_ENABLED =
  process.env.ENABLE_SEARCH_GROUNDING === 'true';

export function warnIfSearchGroundingEnabled() {
  if (!SEARCH_GROUNDING_ENABLED) return;
  console.warn(
    '⚠️ UWAGA: Search Grounding jest WŁĄCZONY. ' +
      'To jest najdroższa funkcja API ($14/1000 zapytań). ' +
      'Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, ' +
      'bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.',
  );
}

/** Limit kroków tool-loop (ochrona przed pętlami / kosztami). */
export const maxSteps = 3;
