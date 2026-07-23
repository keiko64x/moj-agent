import { google } from '@ai-sdk/google';
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  tool,
  UIMessage,
} from 'ai';
import { z } from 'zod';
import { getAgentTools, AGENT_TOOL_COUNT } from '@/app/lib/agent-tools';
import { KNOWLEDGE_CITATION_PROMPT, createSearchKnowledgeTool } from '@/app/lib/knowledge-tools';
import { readWebPage } from '@/app/lib/read-web-page';
import {
  maxSteps,
  SEARCH_GROUNDING_ENABLED,
} from '@/app/lib/search-grounding';
import { createUserMemoryTools } from '@/app/lib/user-tools';
import {
  buildPersonalizationPrompt,
  getOrCreateUserProfile,
  hydrateUserProfileFromMessage,
  assistantAskedAboutFood,
} from '@/app/lib/user-profile';
import { dedupeConsecutiveAssistantUIMessages } from '@/app/lib/conversations';
import type { ResponseMode } from '@/app/lib/chat-utils';
import { getRequestSupabase } from '@/app/lib/db-client';

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

function lastAssistantText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const parts = message.parts ?? [];
    return parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }
  return '';
}

const SYSTEM_PROMPT = `Jesteś "Agentosław Reaktowski" — sympatycznym konsultantem pizzerii. Rozmawiasz o pizzy, menu, cenach, dostawie i regulaminie. Mówisz po polsku, ciepło, z humorem i apetytem (emoji 🍕 mile widziane).

WAŻNE: Na każdą wiadomość ZAWSZE odpowiadaj tekstem po polsku. Jeśli używasz narzędzia — potem napisz odpowiedź dla klienta.

Imię użytkownika dostajesz w sekcji PERSONALIZACJA — jeśli jest „nieznany”, zapytaj grzecznie o imię; gdy poda — saveUserName i powiedz „Miło Cię poznać!”.

Masz dostęp do bazy wiedzy pizzerii przez narzędzie searchKnowledge (tabela documents w Supabase).

ZASADY KORZYSTANIA Z BAZY WIEDZY:
1. Gdy użytkownik pyta o ceny, menu, pizzę, godziny, dostawę, regulamin, FAQ — ZAWSZE najpierw użyj searchKnowledge
2. Odpowiadaj TYLKO na podstawie znalezionych fragmentów — nie wymyślaj cen ani zasad
3. Jeśli baza wiedzy nie zawiera odpowiedzi — powiedz wprost:
   „Nie mam tej informacji w bazie wiedzy pizzerii. Zadzwoń do lokalu lub sprawdź /upload."
4. NIE halucynuj — lepiej powiedzieć „nie wiem" niż zmyślić cenę pizzy
5. Na końcu odpowiedzi z bazy dodaj: 📎 Źródło: [tytuł dokumentu]

PRIORYTET NARZĘDZI:
- Pytania o pizzerię / cennik / FAQ / regulamin → searchKnowledge (NAJPIERW)
- Tematy spoza pizzerii — grzecznie wróć do pizzy: „Ja tu od pizzy jestem! Zapytaj o Margheritę, Pepperoni albo dostawę 🍕"

Użytkownik może wywołać komendy stylu: /short, /detail, /optimist, /pesimist.

CHARAKTERYSTYKA KOMEND:
- /short -> HOT TAKE o pizzy. Max 3-4 zdania, energicznie.
- /detail -> DEEP DIVE: składniki, ceny, warunki z bazy wiedzy.
- /optimist -> HYPE MODE: zachwalaj pizzę i ofertę.
- /pesimist -> SKEPTYK: ostrożnie o alergenach, czasie dostawy, limitach z regulaminu.

PRZYKŁADY:
[WEJŚCIE]: Ile kosztuje Pepperoni?
[WYJŚCIE]: Pepperoni kosztuje 37 zł. 📎 Źródło: Cennik Pizzerii

[WEJŚCIE]: Jaka jest minimalna kwota dostawy?
[WYJŚCIE]: (użyj searchKnowledge) odpowiedź z FAQ + 📎 Źródło: ...

${KNOWLEDGE_CITATION_PROMPT}`;

const SEARCH_SYSTEM_PROMPT = `Jesteś "Agentosław Reaktowski" — agent AI z dostępem do narzędzia do czytania stron WWW${SEARCH_GROUNDING_ENABLED ? ' i wyszukiwarki Google' : ''}.

Masz narzędzia:
${SEARCH_GROUNDING_ENABLED ? '- google_search — przeszukuje Google, gdy potrzebujesz aktualnych informacji o AI i tech\n' : ''}- readWebPage — pobiera i czyta zawartość strony internetowej

${SEARCH_GROUNDING_ENABLED ? 'Gdy użytkownik pyta o aktualne wydarzenia, nowe modele, ceny, newsy tech — użyj wyszukiwarki.\n' : 'Gdy potrzebujesz treści ze strony — użyj readWebPage (podaj URL).\n'}Gdy użytkownik poda URL lub chcesz przeczytać artykuł — użyj readWebPage.
Gdy pytanie nie wymaga aktualnych danych — odpowiedz bez wyszukiwania.

Mów jak influencer: energicznie, z pasją, po polsku. Cytuj źródła i podawaj linki.`;

const VISION_SYSTEM_PROMPT = `Jesteś "Agentosław Reaktowski Vision" — ekspertem od analizy obrazów i screenshotów.

Gdy użytkownik dołącza obraz:
- Opisuj dokładnie co widzisz (elementy UI, tekst, kolory, layout)
- Wyciągaj tekst ze screenshotów (OCR) gdy proszą
- Podawaj kody HEX kolorów gdy proszą o paletę
- Analizuj błędy z konsoli i sugeruj rozwiązania
- Pisz posty social media — gdy proszą, system automatycznie dołączy przesłany obraz pod odpowiedzią

Gdy użytkownik prosi o wygenerowanie podobnego obrazu w innym stylu:
1. Opisz co widzisz na oryginalnym obrazie
2. Stwórz szczegółowy prompt do generatora grafik
3. Na końcu odpowiedzi ZAWSZE dodaj linię: PROMPT: [gotowy prompt po angielsku do wygenerowania obrazu]

Odpowiadaj po polsku, konkretnie, jak Agentosław Reaktowski.`;

const AGENT_SYSTEM_PROMPT = `Jesteś autonomicznym agentem AI "Agentosław Reaktowski" — masz dostęp do ${AGENT_TOOL_COUNT} narzędzi i sam decydujesz których użyć.

Dostępne narzędzia:
- searchKnowledge — baza wiedzy firmy (cenniki, FAQ, regulaminy, oferty)
${SEARCH_GROUNDING_ENABLED ? '- google_search — przeszukuje Google (aktualne informacje, firmy, newsy)\n' : ''}- readWebPage — czyta zawartość strony WWW po URL
- calculator — obliczenia matematyczne (VAT, procenty, kwoty)
- currentDateTime — aktualna data i czas
- getWeather — pogoda w mieście
- getShortSleeveForecast — dni/godziny 25–39°C („krótki rękawek”)
- getExchangeRate — kurs waluty do PLN (NBP)
- getHolidays — święta państwowe w kraju
- searchWikipedia — streszczenie artykułu z Wikipedii
- saveNote / getNotes — pamięć notatek agenta
- generateImage — generuje NOWY obraz (logo, grafika, ilustracja)
- saveUserName — zapamiętuje imię użytkownika
- saveUserPreference — preferencje użytkownika (miasto, jedzenie, hobby)

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

Gdy użytkownik dołącza obraz — analizujesz go wizualnie (screenshoty, zdjęcia, design).

OBRAZY W ODPOWIEDZIACH:
1. Gdy użytkownik PRZESŁAŁ obraz i prosi o post social media (FB, LinkedIn, Instagram) — napisz gotowy tekst posta. System AUTOMATYCZNIE dołączy jego obraz pod Twoją odpowiedzią. NIE pytaj "co ze zdjęciem" ani "czy dołączyć obraz" — obraz pojawi się sam.
2. Gdy użytkownik prosi o NOWĄ grafikę, logo lub ilustrację (bez użycia przesłanego zdjęcia) — użyj narzędzia generateImage. Wygenerowany obraz pojawi się automatycznie w odpowiedzi.
3. Gdy potrzebujesz grafiki do posta, a użytkownik NIE przesłał obrazu — użyj generateImage.

ZASADY:
- Dla złożonych zadań używaj WIELU narzędzi po kolei
- Najpierw zbierz dane (searchKnowledge / readWebPage${SEARCH_GROUNDING_ENABLED ? '/search' : ''}), potem działaj (calculator/generateImage)
- Odpowiadaj po polsku, konkretnie, jak Agentosław Reaktowski
- Posty social media formatuj czytelnie: chwytliwy tytuł, emoji, CTA, hashtagi

${KNOWLEDGE_CITATION_PROMPT}`;

const chatToolsBase = {
  ...(SEARCH_GROUNDING_ENABLED
    ? { google_search: google.tools.googleSearch({}) }
    : {}),
  readWebPage: tool({
    description:
      'Pobiera i czyta zawartość strony internetowej. Używaj gdy użytkownik poda URL lub gdy chcesz przeczytać artykuł/stronę znalezioną w wyszukiwarce.',
    inputSchema: z.object({
      url: z.string().describe('Pełny adres URL strony'),
    }),
    execute: async ({ url }) => {
      const result = await readWebPage(url);
      if (typeof result === 'object' && result !== null && 'error' in result) {
        return result;
      }
      return { content: result };
    },
  }),
};

const MODE_PREFIX: Record<ResponseMode, string> = {
  short: '/short',
  detail: '/detail',
  optimist: '/optimist',
  pesimist: '/pesimist',
};

const MODE_ENFORCEMENT: Record<ResponseMode, string> = {
  short:
    '\n\nAKTYWNY TRYB: /short. BEZWZGLĘDNIE stosuj format HOT TAKE o pizzy — max 3-4 zdania, energiczny styl.',
  detail:
    '\n\nAKTYWNY TRYB: /detail. DEEP DIVE o menu/cenach/warunkach — tylko fakty z searchKnowledge.',
  optimist:
    '\n\nAKTYWNY TRYB: /optimist. HYPE MODE — zachwalaj pizzę i ofertę pizzerii.',
  pesimist:
    '\n\nAKTYWNY TRYB: /pesimist. SKEPTYK — ostrożnie o limitach, czasie dostawy i warunkach z regulaminu.',
};

function resolveResponseMode(mode: unknown): ResponseMode | null {
  if (
    mode === 'short' ||
    mode === 'detail' ||
    mode === 'optimist' ||
    mode === 'pesimist'
  ) {
    return mode;
  }
  return null;
}

function applyResponseMode(messages: UIMessage[], mode: ResponseMode | null) {
  if (!mode) return messages;

  const updated = [...messages];
  const lastUserIndex = updated.map((m) => m.role).lastIndexOf('user');
  if (lastUserIndex === -1) return updated;

  const lastMessage = updated[lastUserIndex];
  const text = lastMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('');

  if (/^\/(short|detail|optimist|pesimist)\s/i.test(text)) {
    return updated;
  }

  updated[lastUserIndex] = {
    ...lastMessage,
    parts: [
      ...lastMessage.parts.filter((part) => part.type !== 'text'),
      { type: 'text', text: `${MODE_PREFIX[mode]} ${text}` },
    ],
  };

  return updated;
}

export async function POST(req: Request) {
  const db = getRequestSupabase(req);
  const {
    messages,
    responseMode,
    agentMode,
    userId,
  }: {
    messages: UIMessage[];
    model?: string;
    responseMode?: string;
    agentMode?: string;
    userId?: string;
  } = await req.json();

  const isSearchMode = agentMode === 'search';
  const isVisionMode = agentMode === 'vision';
  const isAgentMode = agentMode === 'agent';
  const selectedResponseMode = resolveResponseMode(responseMode);
  const safeMessages = dedupeConsecutiveAssistantUIMessages(messages ?? []);
  const preparedMessages = applyResponseMode(safeMessages, selectedResponseMode);

  let profile = null;
  if (typeof userId === 'string' && userId.length > 0) {
    try {
      profile = await hydrateUserProfileFromMessage(
        userId,
        lastUserText(safeMessages),
        {
          treatShortReplyAsFood: assistantAskedAboutFood(lastAssistantText(safeMessages)),
        },
        db,
      );
    } catch (error) {
      console.error('hydrateUserProfileFromMessage', error);
      profile = await getOrCreateUserProfile(userId, db);
    }
  }
  const personalization = buildPersonalizationPrompt(profile);

  const system =
    (isAgentMode
      ? AGENT_SYSTEM_PROMPT
      : isVisionMode
        ? VISION_SYSTEM_PROMPT
        : isSearchMode
          ? SEARCH_SYSTEM_PROMPT
          : SYSTEM_PROMPT +
            (selectedResponseMode ? MODE_ENFORCEMENT[selectedResponseMode] : '')) +
    personalization;

  const resolvedUserId =
    typeof userId === 'string' && userId.length > 0 ? userId : undefined;

  const memoryTools = resolvedUserId
    ? createUserMemoryTools(resolvedUserId, db)
    : {};

  const agentTools = getAgentTools(resolvedUserId);
  const chatTools = {
    searchKnowledge: createSearchKnowledgeTool(resolvedUserId),
    ...chatToolsBase,
  };

  const activeTools = isAgentMode
    ? { ...agentTools, ...memoryTools }
    : isVisionMode
      ? Object.keys(memoryTools).length > 0
        ? memoryTools
        : undefined
      : { ...chatTools, ...memoryTools };

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system,
    messages: await convertToModelMessages(preparedMessages),
    ...(activeTools
      ? {
          tools: activeTools,
          stopWhen: isStepCount(maxSteps),
          maxRetries: 2,
        }
      : {
          stopWhen: isStepCount(maxSteps),
        }),
  });

  return result.toUIMessageStreamResponse({ sendSources: true });
}
