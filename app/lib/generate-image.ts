import { GoogleGenAI, Modality } from '@google/genai';
import { generateWithPollinations } from '@/app/lib/fallback-image';
import { getGoogleApiKeys } from '@/app/lib/google-api-keys';

const PRIMARY_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

function isFallbackEnabled() {
  return process.env.IMAGE_FALLBACK_ENABLED !== 'false';
}

export function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('quota') ||
    message.includes('Quota exceeded')
  );
}

export function formatImageError(error: unknown, keyCount = 1): string {
  const message = error instanceof Error ? error.message : String(error);

  if (isQuotaError(error)) {
    if (keyCount > 1) {
      return `Limit darmowego API Google został przekroczony na wszystkich ${keyCount} kluczach. Utwórz nowy klucz na aistudio.google.com/apikey i dodaj go do .env.local jako GOOGLE_GENERATIVE_AI_API_KEY_2.`;
    }

    return 'Limit darmowego API Google został wyczerpany. Utwórz nowy klucz na aistudio.google.com/apikey (zaczyna się od AIza...) i wklej do .env.local, potem zrestartuj serwer.';
  }

  if (message.includes('Model nie zwrócił obrazu')) {
    return message;
  }

  if (message.length > 280 || message.includes('GenerateContentRequest')) {
    return 'Nie udało się wygenerować obrazu. Spróbuj krótszego opisu lub ponów za chwilę.';
  }

  return message;
}

function extractImageResponse(
  response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>,
) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let image: string | null = null;
  let text = '';

  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      image = `data:${mime};base64,${part.inlineData.data}`;
    }
  }

  if (!image) {
    throw new Error('Model nie zwrócił obrazu. Spróbuj innego opisu.');
  }

  return { image, text: text || 'Obraz wygenerowany przez Google Gemini.' };
}

async function generateWithGoogle(
  apiKey: string,
  prompt: string,
): Promise<{ image: string; text: string; model: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: PRIMARY_IMAGE_MODEL,
      contents: prompt.trim(),
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        abortSignal: controller.signal,
      },
    });

    const result = extractImageResponse(response);
    return { ...result, model: PRIMARY_IMAGE_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateImageFromPrompt(prompt: string): Promise<{
  image: string;
  text: string;
  model: string;
}> {
  const apiKeys = getGoogleApiKeys();
  let lastError: unknown = new Error('Brak klucza API Google.');

  if (apiKeys.length > 0) {
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        return await generateWithGoogle(apiKeys[i], prompt);
      } catch (error) {
        lastError = error;

        if (isQuotaError(error) && i < apiKeys.length - 1) {
          continue;
        }

        break;
      }
    }
  }

  if (isFallbackEnabled()) {
    try {
      return await generateWithPollinations(prompt);
    } catch (fallbackError) {
      if (apiKeys.length === 0) {
        throw new Error(
          'Brak klucza Google API. Dodaj GOOGLE_GENERATIVE_AI_API_KEY do .env.local i zrestartuj serwer.',
        );
      }

      const googleMessage = formatImageError(lastError, apiKeys.length);
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`${googleMessage} Zapasowy silnik też nie zadziałał: ${fallbackMessage}`);
    }
  }

  if (apiKeys.length === 0) {
    throw new Error('Brak klucza API. Ustaw GOOGLE_GENERATIVE_AI_API_KEY w .env.local.');
  }

  throw new Error(formatImageError(lastError, apiKeys.length));
}
