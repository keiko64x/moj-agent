const DEFAULT_TIMEOUT_MS = 5000;

type FetchResult =
  | { ok: true; response: Response }
  | { ok: false; error: string };

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    return { ok: true, response };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        error: 'Timeout — serwer nie odpowiedział w 5 sekund. Spróbuj ponownie.',
      };
    }

    return {
      ok: false,
      error: `Błąd połączenia: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
    };
  }
}

export function httpError(status: number): string {
  return `API zwróciło błąd ${status}. Sprawdź parametry.`;
}
