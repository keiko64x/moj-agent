import { NextResponse } from 'next/server';
import {
  formatImageError,
  generateImageFromPrompt,
  isQuotaError,
} from '@/app/lib/generate-image';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Brak opisu obrazu (prompt).' }, { status: 400 });
  }

  try {
    const result = await generateImageFromPrompt(prompt);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Przekroczono limit czasu (45 s). Generowanie trwa zwykle 5–15 sekund.' },
        { status: 500 },
      );
    }

    const message = formatImageError(error);
    const status = isQuotaError(error) ? 429 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
