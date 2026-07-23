import { google } from '@ai-sdk/google';
import { convertToModelMessages, isStepCount, streamText, UIMessage } from 'ai';
import { getReactTools, REACT_TOOL_COUNT } from '@/app/lib/agent-tools';
import { ERROR_HANDLING_PROMPT } from '@/app/lib/error-handling-prompt';
import { KNOWLEDGE_CITATION_PROMPT } from '@/app/lib/knowledge-tools';
import {
  maxSteps,
  SEARCH_GROUNDING_ENABLED,
} from '@/app/lib/search-grounding';
import { createUserMemoryTools } from '@/app/lib/user-tools';
import {
  buildPersonalizationPrompt,
  hydrateUserProfileFromMessage,
} from '@/app/lib/user-profile';
import { resolveRequestUserId } from '@/app/lib/db-client';

if (process.env.ENABLE_SEARCH_GROUNDING === 'true') {
  console.warn(
    '⚠️ UWAGA: Search Grounding jest WŁĄCZONY. ' +
      'To jest najdroższa funkcja API ($14/1000 zapytań). ' +
      'Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, ' +
      'bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.',
  );
}

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    const parts = message.parts ?? [];
    return parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }
  return '';
}

const REACT_SYSTEM_PROMPT = `Jesteś autonomicznym agentem. Gdy dostajesz ZADANIE (nie pytanie),
MUSISZ je zrealizować krok po kroku.

Masz dostęp do ${REACT_TOOL_COUNT} narzędzi:
- searchKnowledge — baza wiedzy firmy (cenniki, FAQ, regulaminy, oferty)
${SEARCH_GROUNDING_ENABLED ? '- google_search — przeszukuje Google (aktualne informacje)\n' : ''}- readWebPage — czyta zawartość strony WWW po URL
- calculator — obliczenia matematyczne
- currentDateTime — aktualna data i czas
- getWeather — pogoda w mieście
- getExchangeRate — kurs waluty do PLN (NBP)
- getHolidays — święta państwowe w kraju
- searchWikipedia — streszczenie artykułu z Wikipedii
- saveNote — zapis notatki w pamięci agenta
- getNotes — pobranie zapisanych notatek
- saveUserName — zapisuje imię użytkownika w profilu
- saveUserPreference — zapisuje preferencje (miasto, jedzenie, hobby)

Masz dostęp do bazy wiedzy firmy przez narzędzie searchKnowledge.

ZASADY KORZYSTANIA Z BAZY WIEDZY:
1. Gdy użytkownik pyta o ceny, pakiety, oferty, regulamin, FAQ — ZAWSZE użyj searchKnowledge
2. Odpowiadaj TYLKO na podstawie znalezionych fragmentów — nie wymyślaj
3. Jeśli baza wiedzy nie zawiera odpowiedzi — powiedz wprost:
   „Nie mam tej informacji w bazie wiedzy. Skontaktuj się z firmą."
4. NIE halucynuj — lepiej powiedzieć „nie wiem" niż zmyślić cenę

PRIORYTET NARZĘDZI:
- Pytania o firmę/cennik/FAQ → searchKnowledge (NAJPIERW)
- Pytania ogólne → ${SEARCH_GROUNDING_ENABLED ? 'Google Search lub ' : ''}inne narzędzia
- Obliczenia → calculator

## TWÓJ PROCES:

Dla KAŻDEGO kroku wypisz:

### 🧠 Myślę...
Co muszę teraz zrobić? Jakie informacje mi brakuje?
Które narzędzie użyć?

Potem UŻYJ narzędzia.

Po otrzymaniu wyniku:

### 👁️ Obserwuję...
Co dostałem? Czy to wystarczy do odpowiedzi?
Jeśli nie — jaki następny krok?

Powtarzaj aż będziesz mieć WSZYSTKO co potrzebne.

Na koniec:

### ✅ Wynik końcowy
Podaj pełną, konkretną odpowiedź opartą na zebranych danych.
Cytuj źródła (baza wiedzy, API, Wikipedia${SEARCH_GROUNDING_ENABLED ? ', Google' : ''}).

## ZASADY:
- ZAWSZE pokazuj tok myślenia — użytkownik widzi cały proces
- NIE zgaduj — jeśli potrzebujesz danych, UŻYJ narzędzia
- Maksymalnie ${maxSteps} głównych kroków
- Jeśli narzędzie zwróci błąd — spróbuj inaczej lub poinformuj
- ŁĄCZ dane z wielu narzędzi w spójną odpowiedź

${KNOWLEDGE_CITATION_PROMPT}

${ERROR_HANDLING_PROMPT}`;

export async function POST(req: Request) {
  const { messages, userId: bodyUserId }: { messages: UIMessage[]; userId?: string } =
    await req.json();

  const { userId, client: db } = await resolveRequestUserId(req, bodyUserId);
  const resolvedUserId = userId ?? undefined;

  const profile = resolvedUserId
    ? await hydrateUserProfileFromMessage(resolvedUserId, lastUserText(messages), undefined, db)
    : null;
  const memoryTools = resolvedUserId
    ? createUserMemoryTools(resolvedUserId, db)
    : {};

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: REACT_SYSTEM_PROMPT + buildPersonalizationPrompt(profile),
    messages: await convertToModelMessages(messages),
    tools: {
      ...getReactTools(resolvedUserId),
      ...memoryTools,
    },
    // maxSteps: AI SDK 7 → stopWhen
    stopWhen: isStepCount(maxSteps),
  });

  return result.toUIMessageStreamResponse({ sendSources: true });
}
