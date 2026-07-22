import { NextResponse } from 'next/server';
import { splitIntoChunks } from '@/app/lib/chunking';
import { embedText } from '@/app/lib/embeddings';
import { insertDocumentChunk } from '@/app/lib/knowledge';
import { isSupabaseConfigured } from '@/app/lib/supabase';

type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'progress'; current: number; total: number; message: string }
  | { type: 'done'; success: true; chunks_saved: number }
  | { type: 'error'; error: string };

function encodeLine(event: ProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase nie jest skonfigurowane. Uzupełnij klucze w /setup.' },
      { status: 503 },
    );
  }

  let title = '';
  let content = '';

  try {
    const body = (await req.json()) as { title?: string; content?: string };
    title = typeof body.title === 'string' ? body.title.trim() : '';
    content = typeof body.content === 'string' ? body.content.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 });
  }

  if (!title || !content) {
    return NextResponse.json(
      { error: 'Pola title i content są wymagane' },
      { status: 400 },
    );
  }

  const chunks = splitIntoChunks(content);
  if (chunks.length === 0) {
    return NextResponse.json({ error: 'Brak fragmentów do zapisania' }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encodeLine({ type: 'start', total: chunks.length }));

        for (let i = 0; i < chunks.length; i++) {
          const current = i + 1;
          controller.enqueue(
            encodeLine({
              type: 'progress',
              current,
              total: chunks.length,
              message: `Przetwarzam fragment ${current} z ${chunks.length}...`,
            }),
          );

          const embedding = await embedText(chunks[i]);
          await insertDocumentChunk({
            title,
            content: chunks[i],
            embedding,
            metadata: {
              source: title,
              chunk_index: i,
              total_chunks: chunks.length,
            },
          });
        }

        controller.enqueue(
          encodeLine({
            type: 'done',
            success: true,
            chunks_saved: chunks.length,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Błąd uploadu wiedzy';
        console.error('POST /api/upload-knowledge', message);
        controller.enqueue(encodeLine({ type: 'error', error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
