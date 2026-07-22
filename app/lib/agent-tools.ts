import { google } from '@ai-sdk/google';
import { tool } from 'ai';
import { z } from 'zod';
import { fetchWithTimeout, httpError } from '@/app/lib/fetch-with-timeout';
import { generateImageFromPrompt } from '@/app/lib/generate-image';
import { getAgentNotes, saveAgentNote } from '@/app/lib/notes-store';
import { readWebPage } from '@/app/lib/read-web-page';
import { SEARCH_GROUNDING_ENABLED } from '@/app/lib/search-grounding';
import { searchKnowledge } from '@/app/lib/knowledge-tools';
import { describeWeatherCode, findShortSleeveWindows } from '@/app/lib/weather-utils';

function safeCalculate(expression: string): number {
  const forbidden = /import|require|eval|process|fetch|function|=>|;/i;
  if (forbidden.test(expression)) {
    throw new Error('Wyrażenie zawiera niedozwolone znaki');
  }

  const sanitized = expression.replace(/\s/g, '');
  if (!/^[0-9+\-*/().%]+$/.test(sanitized)) {
    throw new Error('Wyrażenie zawiera niedozwolone znaki');
  }

  const result = Function(`"use strict"; return (${expression})`)();
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Wynik nie jest poprawną liczbą');
  }

  return result;
}

export const calculator = tool({
  description:
    'Oblicza wyrażenia matematyczne. Używaj do dokładnych obliczeń, VAT, procentów, kwot brutto/netto.',
  inputSchema: z.object({
    expression: z
      .string()
      .describe('Wyrażenie matematyczne, np. "8500 * 0.23" lub "5000 / 4.28"'),
  }),
  execute: async ({ expression }) => {
    try {
      const result = safeCalculate(expression);
      return { expression, result };
    } catch {
      return { error: `Nie mogę obliczyć: ${expression}` };
    }
  },
});

export const currentDateTime = tool({
  description: 'Zwraca aktualną datę i czas w Polsce.',
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      dateTime: now.toLocaleString('pl-PL', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: 'Europe/Warsaw',
      }),
      dayOfWeek: now.toLocaleDateString('pl-PL', {
        weekday: 'long',
        timeZone: 'Europe/Warsaw',
      }),
      timestamp: now.toISOString(),
    };
  },
});

export const getWeather = tool({
  description: 'Sprawdza aktualną pogodę w podanym mieście.',
  inputSchema: z.object({
    city: z.string().describe('Nazwa miasta, np. "Warszawa"'),
  }),
  execute: async ({ city }) => {
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      return { error: 'Podaj nazwę miasta' };
    }

    const geoResult = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedCity)}&count=1&language=pl`,
    );

    if (!geoResult.ok) {
      return { error: geoResult.error };
    }

    if (!geoResult.response.ok) {
      return { error: httpError(geoResult.response.status) };
    }

    const geoData = (await geoResult.response.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string }>;
    };

    const location = geoData.results?.[0];
    if (!location) {
      return { error: `Nie znalazłem miasta ${trimmedCity}. Sprawdź pisownię.` };
    }

    const weatherResult = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
    );

    if (!weatherResult.ok) {
      return { error: weatherResult.error };
    }

    if (!weatherResult.response.ok) {
      return { error: httpError(weatherResult.response.status) };
    }

    const weatherData = (await weatherResult.response.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        weather_code: number;
      };
    };

    const current = weatherData.current;
    if (!current) {
      return { error: `Brak danych pogodowych dla ${location.name}` };
    }

    return {
      city: location.name,
      temperature: `${current.temperature_2m}°C`,
      humidity: `${current.relative_humidity_2m}%`,
      windSpeed: `${current.wind_speed_10m} km/h`,
      description: describeWeatherCode(current.weather_code),
    };
  },
});

export const getShortSleeveForecast = tool({
  description:
    'Analizuje godzinową prognozę temperatury i wskazuje dni/godziny z pogodą „na krótki rękawek” (25–39°C). Używaj przy planowaniu podróży.',
  inputSchema: z.object({
    city: z.string().describe('Nazwa miasta docelowego'),
    days: z
      .number()
      .min(1)
      .max(16)
      .optional()
      .describe('Liczba dni prognozy (domyślnie 7)'),
  }),
  execute: async ({ city, days = 7 }) => {
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      return { error: 'Podaj nazwę miasta' };
    }

    const forecastDays = Math.min(Math.max(days, 1), 16);

    const geoResult = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedCity)}&count=1&language=pl`,
    );

    if (!geoResult.ok) return { error: geoResult.error };
    if (!geoResult.response.ok) return { error: httpError(geoResult.response.status) };

    const geoData = (await geoResult.response.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string }>;
    };

    const location = geoData.results?.[0];
    if (!location) {
      return { error: `Nie znalazłem miasta ${trimmedCity}. Sprawdź pisownię.` };
    }

    const forecastResult = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&hourly=temperature_2m&forecast_days=${forecastDays}&timezone=auto`,
    );

    if (!forecastResult.ok) return { error: forecastResult.error };
    if (!forecastResult.response.ok) {
      return { error: httpError(forecastResult.response.status) };
    }

    const forecast = (await forecastResult.response.json()) as {
      hourly?: { time?: string[]; temperature_2m?: number[] };
    };

    const times = forecast.hourly?.time ?? [];
    const temps = forecast.hourly?.temperature_2m ?? [];

    if (times.length === 0 || temps.length === 0) {
      return { error: `Brak godzinowej prognozy dla ${location.name}` };
    }

    const { slots, maxTempOverall, daysAnalyzed } = findShortSleeveWindows(times, temps);

    if (slots.length === 0) {
      return {
        city: location.name,
        shortSleevePossible: false,
        daysAnalyzed,
        maxTempOverall: `${maxTempOverall}°C`,
        slots: [],
        message:
          'Pogoda na krótki rękawek się nie szykuje — temperatura nie osiągnie 25°C. Warto spakować cieplejszą bluzę.',
      };
    }

    return {
      city: location.name,
      shortSleevePossible: true,
      daysAnalyzed,
      maxTempOverall: `${maxTempOverall}°C`,
      slots: slots.slice(0, 24),
      message: `Znaleziono ${slots.length} przedział(ów) 25–39°C — idealnie na krótki rękawek.`,
    };
  },
});

export const getExchangeRate = tool({
  description: 'Sprawdza kurs waluty do PLN z NBP.',
  inputSchema: z.object({
    currency: z.string().describe('Kod waluty, np. "EUR", "USD", "GBP"'),
  }),
  execute: async ({ currency }) => {
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return { error: 'Podaj 3-literowy kod waluty (np. EUR, USD)' };
    }

    const result = await fetchWithTimeout(
      `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`,
    );

    if (!result.ok) {
      return { error: result.error };
    }

    if (result.response.status === 404) {
      return {
        error: `Waluta ${code} nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF`,
      };
    }

    if (!result.response.ok) {
      return { error: httpError(result.response.status) };
    }

    const data = (await result.response.json()) as {
      rates?: Array<{ mid: number; effectiveDate: string }>;
    };

    const rate = data.rates?.[0];
    if (!rate) {
      return { error: `Brak danych kursu dla ${code}` };
    }

    return {
      currency: code,
      rate: rate.mid,
      date: rate.effectiveDate,
      source: 'NBP',
    };
  },
});

export const getHolidays = tool({
  description: 'Sprawdza święta państwowe w danym kraju na dany rok.',
  inputSchema: z.object({
    countryCode: z.string().describe('Kod kraju ISO, np. "PL", "DE"'),
    year: z.number().describe('Rok, np. 2026'),
  }),
  execute: async ({ countryCode, year }) => {
    const code = countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      return { error: 'Podaj 2-literowy kod kraju (np. PL, DE, US)' };
    }

    const result = await fetchWithTimeout(
      `https://date.nager.at/api/v3/publicholidays/${year}/${code}`,
    );

    if (!result.ok) {
      return { error: result.error };
    }

    if (!result.response.ok) {
      return {
        error: `Nie znalazłem świąt dla kraju ${code}. Popularne: PL, DE, US, GB, FR`,
      };
    }

    const holidays = (await result.response.json()) as Array<{
      date: string;
      localName: string;
      name: string;
    }>;

    return holidays.slice(0, 15).map((holiday) => ({
      date: holiday.date,
      localName: holiday.localName,
      name: holiday.name,
    }));
  },
});

export const searchWikipedia = tool({
  description: 'Wyszukuje artykuł w Wikipedii i zwraca streszczenie.',
  inputSchema: z.object({
    query: z.string().describe('Hasło do wyszukania w Wikipedii'),
  }),
  execute: async ({ query }) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { error: 'Podaj hasło do wyszukania w Wikipedii' };
    }

    const summaryResult = await fetchWithTimeout(
      `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(trimmedQuery)}`,
    );

    if (summaryResult.ok && summaryResult.response.ok) {
      const summary = (await summaryResult.response.json()) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        thumbnail?: { source?: string };
      };

      return {
        title: summary.title ?? trimmedQuery,
        summary: (summary.extract ?? '').slice(0, 1000),
        url: summary.content_urls?.desktop?.page ?? '',
        thumbnail: summary.thumbnail?.source ?? null,
      };
    }

    const searchResult = await fetchWithTimeout(
      `https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmedQuery)}&format=json&origin=*`,
    );

    if (!searchResult.ok) {
      return { error: searchResult.error };
    }

    if (!searchResult.response.ok) {
      return { error: httpError(searchResult.response.status) };
    }

    const searchData = (await searchResult.response.json()) as {
      query?: { search?: Array<{ title: string }> };
    };

    const firstResult = searchData.query?.search?.[0];
    if (!firstResult) {
      return { error: `Nie znaleziono artykułu dla "${trimmedQuery}"` };
    }

    const fallbackResult = await fetchWithTimeout(
      `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`,
    );

    if (!fallbackResult.ok) {
      return { error: fallbackResult.error };
    }

    if (!fallbackResult.response.ok) {
      return { error: `Nie znaleziono artykułu dla "${trimmedQuery}"` };
    }

    const fallback = (await fallbackResult.response.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };

    return {
      title: fallback.title ?? firstResult.title,
      summary: (fallback.extract ?? '').slice(0, 1000),
      url: fallback.content_urls?.desktop?.page ?? '',
    };
  },
});

export const saveNote = tool({
  description: 'Zapisuje notatkę w pamięci agenta.',
  inputSchema: z.object({
    title: z.string().describe('Tytuł notatki'),
    content: z.string().describe('Treść notatki'),
  }),
  execute: async ({ title, content }) => {
    saveAgentNote(title, content);
    return { saved: true, title };
  },
});

export const getNotes = tool({
  description: 'Pobiera wszystkie zapisane notatki agenta.',
  inputSchema: z.object({}),
  execute: async () => getAgentNotes(),
});

export const readWebPageTool = tool({
  description:
    'Pobiera i czyta zawartość strony internetowej. Używaj gdy użytkownik poda URL lub chcesz przeczytać artykuł/stronę znalezioną w wyszukiwarce.',
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
});

export const generateImageTool = tool({
  description:
    'Generuje NOWY obraz na podstawie opisu. Używaj gdy użytkownik prosi o logo, grafikę, ilustrację lub wizual do posta, a NIE przesłał własnego zdjęcia. NIE używaj gdy użytkownik chce post z już przesłanym obrazem.',
  inputSchema: z.object({
    prompt: z.string().describe('Szczegółowy opis obrazu do wygenerowania, po angielsku'),
  }),
  execute: async ({ prompt }) => generateImageFromPrompt(prompt),
});

const baseAgentTools = {
  searchKnowledge,
  calculator,
  currentDateTime,
  getWeather,
  getShortSleeveForecast,
  getExchangeRate,
  getHolidays,
  searchWikipedia,
  saveNote,
  getNotes,
  readWebPage: readWebPageTool,
  generateImage: generateImageTool,
};

const baseReactTools = {
  searchKnowledge,
  readWebPage: readWebPageTool,
  calculator,
  currentDateTime,
  getWeather,
  getShortSleeveForecast,
  getExchangeRate,
  getHolidays,
  searchWikipedia,
  saveNote,
  getNotes,
};

/** google_search tylko gdy ENABLE_SEARCH_GROUNDING=true (płatne). */
export function getAgentTools() {
  if (SEARCH_GROUNDING_ENABLED) {
    return {
      google_search: google.tools.googleSearch({}),
      ...baseAgentTools,
    };
  }
  return { ...baseAgentTools };
}

export function getReactTools() {
  if (SEARCH_GROUNDING_ENABLED) {
    return {
      google_search: google.tools.googleSearch({}),
      ...baseReactTools,
    };
  }
  return { ...baseReactTools };
}

/** Snapshot bez google_search (domyślnie wyłączone). */
export const agentTools = {
  ...baseAgentTools,
};

export const reactTools = {
  ...baseReactTools,
};

export const AGENT_TOOL_COUNT = Object.keys(getAgentTools()).length;
export const REACT_TOOL_COUNT = Object.keys(getReactTools()).length;
