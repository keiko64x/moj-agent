import { google } from '@ai-sdk/google';
import { convertToModelMessages, isStepCount, streamText, UIMessage } from 'ai';
import { getReactTools, REACT_TOOL_COUNT } from '@/app/lib/agent-tools';
import { ERROR_HANDLING_PROMPT } from '@/app/lib/error-handling-prompt';
import {
  maxSteps,
  SEARCH_GROUNDING_ENABLED,
} from '@/app/lib/search-grounding';
import { createUserMemoryTools } from '@/app/lib/user-tools';
import {
  buildPersonalizationPrompt,
  hydrateUserProfileFromMessage,
} from '@/app/lib/user-profile';

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

const TRAVEL_SYSTEM_PROMPT = `Jesteś profesjonalnym asystentem podróży. Gdy użytkownik opisuje
planowaną podróż, AUTONOMICZNIE zbierasz wszystkie potrzebne informacje.

Masz dostęp do ${REACT_TOOL_COUNT} narzędzi:
${SEARCH_GROUNDING_ENABLED ? '- google_search — przeszukuje Google (aktualne informacje)\n' : ''}- readWebPage — czyta zawartość strony WWW po URL
- calculator — obliczenia matematyczne
- currentDateTime — aktualna data i czas
- getWeather — aktualna pogoda w mieście
- getShortSleeveForecast — godzinowa analiza 25–39°C („krótki rękawek”)
- getExchangeRate — kurs waluty do PLN (NBP)
- getHolidays — święta państwowe w kraju (countryCode: PL, DE, FR, GB, CZ, AT, JP, ES, PT...)
- searchWikipedia — streszczenie artykułu z Wikipedii
- saveNote — zapis notatki
- getNotes — pobranie notatek
- saveUserName — zapamiętuje imię podróżnika
- saveUserPreference — preferencje (wege, budżet, miasto domowe)

## TWÓJ PROCES:

Dla każdej podróży MUSISZ sprawdzić:
1. 🌤️ Pogodę (getWeather) + analizę „krótki rękawek” (getShortSleeveForecast)
2. 💶 Kurs lokalnej waluty (getExchangeRate)
3. 📅 Dni wolne/święta (getHolidays — currentDateTime po rok)
4. 📖 Informacje o mieście (searchWikipedia)
5. 🌱 Gastro wege/vegan — ${SEARCH_GROUNDING_ENABLED ? 'google_search z frazą np. "best vegan vegetarian restaurants in [miasto]"' : 'searchWikipedia / readWebPage (znane listy wege)'}
6. 🌳 Prastare drzewa — ${SEARCH_GROUNDING_ENABLED ? 'google_search i/lub ' : ''}searchWikipedia (najstarsze / największe drzewa)
7. 🧮 Przeliczenie budżetu jeśli podany (calculator)

Po zebraniu danych, wygeneruj GOTOWY PLAN — użyj nagłówków dokładnie w tym formacie (## lub ###):

## 🗺️ Plan podróży: [MIASTO]

### 📋 Podsumowanie
- Destynacja: [miasto, kraj]
- Pogoda: [temperatura, opis]
- Waluta: [kurs]

### 🌤️ Pogoda
[Szczegóły + co spakować]

### 👕 Alert: Krótki Rękawek
Na podstawie getShortSleeveForecast:
- Jeśli są przedziały 25–39°C: wypisz KONKRETNE dni i godziny (np. sobota 12:00–17:00, 28°C)
- Jeśli brak: grzecznie napisz, że pogoda na krótki rękawek się nie szykuje i warto spakować cieplejszą bluzę
- Podaj też najwyższą temperaturę w okresie

### 🌱 Zielone Gastro
Podziel na dwie podlisty:
- **100% wegańskie** — nazwa + krótki opis / dzielnica
- **Przyjazne wegetarianom** — nazwa + krótki opis
Cytuj źródła gdy możesz.

### 🌳 Prastare Olbrzymy
Lista lokalizacji (okolica celu LUB spektakularne miejsca na świecie, jeśli lokalnie brak):
- nazwa parku / rezerwatu / pomnika przyrody
- gatunek drzewa
- szacowany wiek
Źródło: Wikipedia${SEARCH_GROUNDING_ENABLED ? ' lub Google' : ''}.

### 💰 Budżet
[Przeliczenia walutowe, orientacyjne koszty]

### 📅 Ważne daty
[Święta, dni wolne]

### 🏛️ Co zobaczyć
[Atrakcje]

### ✅ Checklist przed wyjazdem
[Lista do spakowania / zrobienia — uwzględnij wnioski z „krótki rękawek”]

## TRYB PORÓWNANIA MIAST

Gdy użytkownik powie "porównaj X i Y":
- Sprawdź pogodę, krótki rękawek, waluty, święta, gastro i drzewa dla OBU miast
- Tabela porównawcza + ### 🏆 Rekomendacja

## ZASADY:
- Używaj PRAWDZIWYCH danych z narzędzi — nie zgaduj
- Jeśli narzędzie zwróci błąd — poinformuj i kontynuuj
- Bądź praktyczny — konkretne rady
- Podawaj ceny w PLN
- Mapowanie walut: Berlin/Paryż/Barcelona/Lizbona/Wiedeń → EUR, Londyn → GBP, Praga → CZK, Tokio → JPY, Warszawa → PLN
- ZAWSZE wypełnij sekcje: Zielone Gastro, Alert Krótki Rękawek, Prastare Olbrzymy
- Maksymalnie ${maxSteps} kroków tool-loop

${ERROR_HANDLING_PROMPT}`;

export async function POST(req: Request) {
  const { messages, userId }: { messages: UIMessage[]; userId?: string } = await req.json();

  const profile =
    typeof userId === 'string' && userId.length > 0
      ? await hydrateUserProfileFromMessage(userId, lastUserText(messages))
      : null;
  const memoryTools =
    typeof userId === 'string' && userId.length > 0
      ? createUserMemoryTools(userId)
      : {};

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: TRAVEL_SYSTEM_PROMPT + buildPersonalizationPrompt(profile),
    messages: await convertToModelMessages(messages),
    tools: { ...getReactTools(), ...memoryTools },
    // maxSteps: AI SDK 7 → stopWhen
    stopWhen: isStepCount(maxSteps),
  });

  return result.toUIMessageStreamResponse({ sendSources: true });
}
