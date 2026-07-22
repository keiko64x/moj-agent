const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

export async function generateWithPollinations(prompt: string): Promise<{
  image: string;
  text: string;
  model: string;
}> {
  const encoded = encodeURIComponent(prompt.trim());
  const url = `${POLLINATIONS_BASE}/${encoded}?width=1024&height=1024&model=flux&nologo=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        `Zapasowy silnik obrazów zwrócił błąd ${response.status}. Spróbuj za chwilę.`,
      );
    }

    const buffer = await response.arrayBuffer();
    const mime = response.headers.get('content-type') ?? 'image/jpeg';
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      image: `data:${mime};base64,${base64}`,
      text:
        'Obraz wygenerowany zapasowym silnikiem (Pollinations.ai), bo limit darmowego API Google został wyczerpany. Aby wrócić do Google Gemini, utwórz nowy klucz na aistudio.google.com/apikey.',
      model: 'pollinations-flux',
    };
  } finally {
    clearTimeout(timeout);
  }
}
