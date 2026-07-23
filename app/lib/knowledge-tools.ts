import { tool } from 'ai';
import { z } from 'zod';
import { searchKnowledgeDocuments } from '@/app/lib/knowledge';

const SEARCH_KNOWLEDGE_DESCRIPTION = `Wyszukuje informacje w bazie wiedzy firmy (cenniki, FAQ, regulaminy, oferty, menu).
Używaj ZAWSZE gdy użytkownik pyta o:
- ceny, pakiety, koszty, menu
- procedury, regulaminy, warunki
- FAQ, pytania o firmę/usługi
- cokolwiek co może być w dokumentach firmowych

Gdy total_found = 0 LUB brak wyników — NIE zgaduj. Powiedz że nie masz informacji w bazie wiedzy.
Gdy odpowiadasz z wyników — ZAWSZE cytuj źródło (source_documents / title).`;

/** Narzędzie RAG — opcjonalnie zawężone do dokumentów danego usera. */
export function createSearchKnowledgeTool(userId?: string) {
  return tool({
    description: SEARCH_KNOWLEDGE_DESCRIPTION,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Pytanie użytkownika, np. "ile kosztuje pakiet premium" lub "ile kosztuje Pepperoni"',
        ),
    }),
    execute: async ({ query }) => {
      try {
        const result = await searchKnowledgeDocuments(query, 0.5, 5, userId);
        if (result.total_found === 0) {
          return {
            results: [],
            total_found: 0,
            source_documents: [],
            message:
              result.message ??
              'Nie znaleziono informacji w bazie wiedzy. Nie wymyślaj odpowiedzi — powiedz wprost że nie wiesz.',
          };
        }
        return {
          results: result.results.map((row) => ({
            title: row.title,
            content: row.content,
            similarity: row.similarity,
            metadata: row.metadata,
            added_at: row.added_at,
          })),
          total_found: result.total_found,
          source_documents: result.source_documents,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Błąd wyszukiwania';
        return {
          results: [],
          total_found: 0,
          source_documents: [],
          message,
        };
      }
    },
  });
}

/** Domyślne narzędzie (bez usera — używaj createSearchKnowledgeTool w API). */
export const searchKnowledge = createSearchKnowledgeTool();

/** Blok promptu W4 — cytowanie i odmowa. */
export const KNOWLEDGE_CITATION_PROMPT = `
CYTOWANIE ŹRÓDEŁ:
Gdy odpowiadasz na podstawie bazy wiedzy (searchKnowledge), ZAWSZE podaj źródło.

Format — na końcu odpowiedzi dodaj:
📎 Źródło: [tytuł dokumentu]

Przykład:
„Pepperoni kosztuje 37 zł.

📎 Źródło: Cennik Pizzerii"

Jeśli odpowiedź łączy dane z wielu dokumentów:
📎 Źródła: Cennik Pizzerii, FAQ

Używaj tytułów z pola source_documents / title z wyniku narzędzia.
Jeśli masz added_at — możesz wspomnieć datę, ale linia 📎 Źródło: jest obowiązkowa.

ODMOWA ODPOWIEDZI:
Gdy searchKnowledge zwróci total_found = 0 LUB similarity < 0.5:
1. NIE próbuj odpowiadać z ogólnej wiedzy
2. Powiedz wprost:
   „Nie mam informacji na ten temat w mojej bazie wiedzy.
   Skontaktuj się z pizzerią bezpośrednio."
3. Opcjonalnie zaproponuj:
   „Mogę za to odpowiedzieć na pytania o cennik, menu, dostawę i regulamin."

WYJĄTEK: Pytania OGÓLNE (pogoda, kurs walut, Wikipedia) — odpowiadaj normalnie
używając innych narzędzi. Odmowa dotyczy TYLKO tematów firmowych / z bazy wiedzy.
`;
