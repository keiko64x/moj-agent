function extractTextFromHtml(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return cleaned.replace(/\s+/g, ' ').trim();
}

export async function readWebPage(url: string): Promise<string | { error: string }> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return { error: 'Podaj adres URL strony' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(trimmedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)',
      },
    });

    if (!response.ok) {
      return { error: `API zwróciło błąd ${response.status}. Sprawdź parametry.` };
    }

    const html = await response.text();
    const text = extractTextFromHtml(html);

    if (!text.trim()) {
      return { error: 'Strona nie zawiera czytelnego tekstu lub jest pusta.' };
    }

    return text.slice(0, 3000);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Timeout — serwer nie odpowiedział w 5 sekund. Spróbuj ponownie.' };
    }

    return {
      error: `Błąd połączenia: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
