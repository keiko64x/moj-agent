import { NextResponse } from 'next/server';
import { embedText, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '@/app/lib/embeddings';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = typeof body.text === 'string' ? body.text : '';

    if (!text.trim()) {
      return NextResponse.json({ error: 'Pole text jest wymagane' }, { status: 400 });
    }

    const embedding = await embedText(text);

    return NextResponse.json({
      embedding,
      dimensions: embedding.length,
      model: EMBEDDING_MODEL,
      expected_dimensions: EMBEDDING_DIMENSIONS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd embeddingu';
    console.error('POST /api/embed', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
