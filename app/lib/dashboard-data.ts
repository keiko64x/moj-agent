import { fetchWithTimeout, httpError } from '@/app/lib/fetch-with-timeout';
import { describeWeatherCode } from '@/app/lib/weather-utils';

export type WeatherData = {
  city: string;
  temperature: string;
  humidity: string;
  windSpeed: string;
  description: string;
  emoji: string;
  /** Najwyższa temperatura dziś + godzina (np. "14:00") */
  todayHigh: string;
  todayHighHour: string;
  /** Najniższa temperatura dziś + godzina */
  todayLow: string;
  todayLowHour: string;
};

export type ExchangeRateData = {
  currency: string;
  rate: number;
  date: string;
  change?: number;
};

export type HolidayData = {
  date: string;
  localName: string;
  name: string;
  daysUntil: number;
};

export type DateTimeData = {
  greeting: string;
  dateTime: string;
  dayOfWeek: string;
};

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

function weatherShortLabel(code: number): string {
  if (code === 0) return 'słońce';
  if (code === 1) return 'prawie słonecznie';
  if (code === 2) return 'częściowo pochmurno';
  if (code === 3) return 'pochmurno';
  if (code <= 48) return 'mgła';
  if (code <= 55) return 'mżawka';
  if (code <= 67) return 'deszcz';
  if (code <= 77) return 'śnieg';
  if (code <= 82) return 'przelotne opady';
  if (code >= 95) return 'burza';
  return 'zmiennie';
}

/** Wybiera kod pogody reprezentatywny dla bloku (deszcz/burza wygrywają). */
function pickDominantWeatherCode(codes: number[]): number {
  if (codes.length === 0) return 3;
  const storm = codes.find((c) => c >= 95);
  if (storm != null) return storm;
  const rain = codes.find((c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82));
  if (rain != null) return rain;
  const snow = codes.find((c) => c >= 71 && c <= 77);
  if (snow != null) return snow;
  const counts = new Map<number, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

function getGreeting(): string {
  const hour = Number(
    new Date().toLocaleString('pl-PL', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Warsaw',
    }),
  );

  if (hour < 12) return 'Dzień dobry';
  if (hour < 18) return 'Dzień dobry';
  return 'Dobry wieczór';
}

export function getCurrentDateTime(): DateTimeData {
  const now = new Date();
  return {
    greeting: getGreeting(),
    dateTime: now.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Warsaw',
    }),
    dayOfWeek: now.toLocaleDateString('pl-PL', {
      weekday: 'long',
      timeZone: 'Europe/Warsaw',
    }),
  };
}

export const FALLBACK_CITY = 'Szczecin';
export const FALLBACK_COORDS = { lat: 53.4285, lon: 14.5528 };

export type ActivityKind = 'spacer' | 'komputer';

export type HourSlot = {
  fromHour: string; // "09:00"
  toHour: string; // "12:00"
  fromHourNum: number;
  toHourNum: number;
  kind: ActivityKind;
  minTemp: number;
  maxTemp: number;
  /** Ikona pogody (słońce, deszcz, …) */
  emoji: string;
  /** Krótka etykieta: słońce / pochmurno / deszcz */
  weatherLabel: string;
};

export type DayPlan = {
  date: string;
  dayLabel: string; // np. "środa, 16 lip"
  slots: HourSlot[];
};

export type WeeklyActivityPlan = {
  city: string;
  days: DayPlan[];
};

/** Godziny widoczne w kalendarzu tygodnia (sen 22–6 pomijamy). */
export const CALENDAR_HOUR_START = 6;
export const CALENDAR_HOUR_END = 22; // wyłącznie
export const CALENDAR_HOUR_COUNT = CALENDAR_HOUR_END - CALENDAR_HOUR_START;

export async function fetchWeatherByCoords(
  lat: number,
  lon: number,
  cityName?: string,
): Promise<WeatherData | { error: string }> {
  const weatherResult = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m&forecast_days=1&timezone=auto`,
  );

  if (!weatherResult.ok) return { error: weatherResult.error };
  if (!weatherResult.response.ok) return { error: httpError(weatherResult.response.status) };

  const weatherData = (await weatherResult.response.json()) as {
    current?: {
      temperature_2m: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
    };
  };

  const current = weatherData.current;
  if (!current) return { error: 'Brak danych pogodowych' };

  const times = weatherData.hourly?.time ?? [];
  const temps = weatherData.hourly?.temperature_2m ?? [];
  let highTemp = current.temperature_2m;
  let lowTemp = current.temperature_2m;
  let highHour = '--:--';
  let lowHour = '--:--';

  if (times.length > 0 && temps.length > 0) {
    highTemp = temps[0]!;
    lowTemp = temps[0]!;
    highHour = `${times[0].slice(11, 13)}:00`;
    lowHour = highHour;
    for (let i = 1; i < times.length; i++) {
      const temp = temps[i];
      if (temp == null) continue;
      const hourLabel = `${times[i].slice(11, 13)}:00`;
      if (temp > highTemp) {
        highTemp = temp;
        highHour = hourLabel;
      }
      if (temp < lowTemp) {
        lowTemp = temp;
        lowHour = hourLabel;
      }
    }
  }

  return {
    city: cityName ?? FALLBACK_CITY,
    temperature: `${current.temperature_2m}°C`,
    humidity: `${current.relative_humidity_2m}%`,
    windSpeed: `${current.wind_speed_10m} km/h`,
    description: describeWeatherCode(current.weather_code),
    emoji: weatherEmoji(current.weather_code),
    todayHigh: `${Math.round(highTemp)}°C`,
    todayHighHour: highHour,
    todayLow: `${Math.round(lowTemp)}°C`,
    todayLowHour: lowHour,
  };
}

export async function reverseGeocodeCity(lat: number, lon: number): Promise<string> {
  const nominatim = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=pl`,
    {
      headers: {
        'User-Agent': 'AgentoslawReaktowskiDashboard/1.0 (educational; contact: local)',
        Accept: 'application/json',
      },
    },
  );

  if (nominatim.ok && nominatim.response.ok) {
    const data = (await nominatim.response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
      };
      name?: string;
    };

    const fromNominatim =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      data.name;

    if (fromNominatim) return fromNominatim;
  }

  // Fallback: Open-Meteo reverse (lepsze CORS w przeglądarce niż Nominatim)
  const openMeteo = await fetchWithTimeout(
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=pl&count=1`,
  );

  if (openMeteo.ok && openMeteo.response.ok) {
    const data = (await openMeteo.response.json()) as {
      results?: Array<{ name?: string; admin1?: string }>;
    };
    const name = data.results?.[0]?.name;
    if (name) return name;
  }

  return FALLBACK_CITY;
}

function padHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Sen 22:00–6:00 — tych godzin nie pokazujemy w planie dnia. */
const ACTIVE_HOUR_START = CALENDAR_HOUR_START;
const ACTIVE_HOUR_END = CALENDAR_HOUR_END;

function isActiveHour(hour: number): boolean {
  return hour >= ACTIVE_HOUR_START && hour < ACTIVE_HOUR_END;
}

function isRaining(weatherCode: number): boolean {
  return (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    weatherCode >= 95
  );
}

/** Spacer: słonecznie (bezchmurnie / prawie) i powyżej 24°C, bez deszczu. */
function isWalkHour(temp: number, weatherCode: number): boolean {
  const sunny = weatherCode === 0 || weatherCode === 1;
  return sunny && temp > 24 && !isRaining(weatherCode);
}

function formatDayLabel(date: Date): string {
  const weekday = date.toLocaleDateString('pl-PL', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '');
  return `${weekday}, ${day} ${month}`;
}

type HourPoint = { hour: number; kind: ActivityKind; temp: number; code: number };

/** Dzieli ciąg godzin tej samej aktywności na bloki 2–3 h (jak w kalendarzu). */
function chunkRunIntoBlocks(run: HourPoint[]): HourSlot[] {
  if (run.length === 0) return [];

  const slots: HourSlot[] = [];
  let offset = 0;

  while (offset < run.length) {
    const remaining = run.length - offset;
    let take: number;
    if (remaining === 4) take = 2;
    else if (remaining >= 3) take = 3;
    else take = remaining;

    const chunk = run.slice(offset, offset + take);
    const temps = chunk.map((h) => h.temp);
    const dominant = pickDominantWeatherCode(chunk.map((h) => h.code));
    const fromHourNum = chunk[0].hour;
    const toHourNum = chunk[chunk.length - 1].hour + 1;
    slots.push({
      fromHour: padHour(fromHourNum),
      toHour: padHour(toHourNum),
      fromHourNum,
      toHourNum,
      kind: chunk[0].kind,
      minTemp: Math.round(Math.min(...temps)),
      maxTemp: Math.round(Math.max(...temps)),
      emoji: weatherEmoji(dominant),
      weatherLabel: weatherShortLabel(dominant),
    });
    offset += take;
  }

  return slots;
}

function mergeHourSlots(hours: HourPoint[]): HourSlot[] {
  if (hours.length === 0) return [];

  const slots: HourSlot[] = [];
  let runStart = 0;

  for (let i = 1; i <= hours.length; i++) {
    const prev = hours[i - 1];
    const curr = hours[i];
    const sameRun =
      curr &&
      curr.kind === prev.kind &&
      curr.hour === prev.hour + 1;

    if (sameRun) continue;

    slots.push(...chunkRunIntoBlocks(hours.slice(runStart, i)));
    runStart = i;
  }

  return slots;
}

export async function fetchWeeklyActivityPlan(
  lat: number,
  lon: number,
  cityName: string,
): Promise<WeeklyActivityPlan | { error: string }> {
  const result = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code&forecast_days=7&timezone=auto`,
  );

  if (!result.ok) return { error: result.error };
  if (!result.response.ok) return { error: httpError(result.response.status) };

  const data = (await result.response.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      weather_code?: number[];
    };
  };

  const times = data.hourly?.time;
  const temps = data.hourly?.temperature_2m;
  const codes = data.hourly?.weather_code;

  if (!times?.length || !temps || !codes) {
    return { error: 'Brak danych godzinowych prognozy' };
  }

  const byDate = new Map<string, HourPoint[]>();

  for (let i = 0; i < times.length; i++) {
    const iso = times[i];
    const dateKey = iso.slice(0, 10);
    const hour = Number(iso.slice(11, 13));
    const temp = temps[i];
    const code = codes[i];
    if (temp == null || code == null || Number.isNaN(hour)) continue;
    if (!isActiveHour(hour)) continue;

    const kind: ActivityKind = isWalkHour(temp, code) ? 'spacer' : 'komputer';
    const list = byDate.get(dateKey) ?? [];
    list.push({ hour, kind, temp, code });
    byDate.set(dateKey, list);
  }

  const days: DayPlan[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([date, hours]) => {
      const sorted = [...hours].sort((a, b) => a.hour - b.hour);
      return {
        date,
        dayLabel: formatDayLabel(new Date(`${date}T12:00:00`)),
        slots: mergeHourSlots(sorted),
      };
    });

  return { city: cityName, days };
}

export async function fetchDashboardWeather(city = 'Szczecin'): Promise<WeatherData | { error: string }> {
  const geoResult = await fetchWithTimeout(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pl`,
  );

  if (!geoResult.ok) return { error: geoResult.error };
  if (!geoResult.response.ok) return { error: httpError(geoResult.response.status) };

  const geoData = (await geoResult.response.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string }>;
  };

  const location = geoData.results?.[0];
  if (!location) {
    return { error: `Nie znalazłem miasta ${city}` };
  }

  return fetchWeatherByCoords(location.latitude, location.longitude, location.name);
}

export async function fetchDashboardRate(
  currency: string,
  previousRate?: number,
): Promise<ExchangeRateData | { error: string }> {
  const code = currency.toUpperCase();
  const result = await fetchWithTimeout(
    `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`,
  );

  if (!result.ok) return { error: result.error };
  if (result.response.status === 404) {
    return { error: `Waluta ${code} nie jest w tabeli NBP` };
  }
  if (!result.response.ok) return { error: httpError(result.response.status) };

  const data = (await result.response.json()) as {
    rates?: Array<{ mid: number; effectiveDate: string }>;
  };

  const rate = data.rates?.[0];
  if (!rate) return { error: `Brak kursu dla ${code}` };

  return {
    currency: code,
    rate: rate.mid,
    date: rate.effectiveDate,
    change: previousRate !== undefined ? Number((rate.mid - previousRate).toFixed(4)) : undefined,
  };
}

export async function fetchDashboardRates(
  currencies: string[] = ['EUR', 'USD'],
  previousRates?: Record<string, number>,
): Promise<ExchangeRateData[]> {
  const results = await Promise.all(
    currencies.map((currency) => fetchDashboardRate(currency, previousRates?.[currency])),
  );

  return results.filter((item): item is ExchangeRateData => !('error' in item));
}

export async function fetchUpcomingHolidays(
  countryCode = 'PL',
  year = new Date().getFullYear(),
): Promise<HolidayData[]> {
  const result = await fetchWithTimeout(
    `https://date.nager.at/api/v3/publicholidays/${year}/${countryCode.toUpperCase()}`,
  );

  if (!result.ok || !result.response.ok) return [];

  const holidays = (await result.response.json()) as Array<{
    date: string;
    localName: string;
    name: string;
  }>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return holidays
    .map((holiday) => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil(
        (holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        date: holiday.date,
        localName: holiday.localName,
        name: holiday.name,
        daysUntil,
      };
    })
    .filter((holiday) => holiday.daysUntil >= 0)
    .slice(0, 4);
}

export function formatUpdatedAt(date: Date) {
  return date.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Warsaw',
  });
}

export function formatHolidayDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Warsaw',
  });
}

export type MedicalCannabisEntry = {
  rank: number;
  name: string;
  producer: string;
  thc: string;
  cbd: string;
  pricePerGram: string;
  note: string;
};

export function getTopMedicalCannabisPL(): MedicalCannabisEntry[] {
  return [
    { rank: 1, name: 'Aurora Sourdough', producer: 'Aurora', thc: '29%', cbd: '<1%', pricePerGram: 'ok. 50–78 zł/g', note: 'Najwyższe THC w aptekach PL; tylko na receptę (Rpw)' },
    { rank: 2, name: 'Canopy Kush Mints', producer: 'Canopy Growth', thc: '28%', cbd: '<1%', pricePerGram: 'ok. 55–75 zł/g', note: 'Hybryda premium; recepta wymagana' },
    { rank: 3, name: 'Aurora Farm Gas / Black Jelly', producer: 'Aurora', thc: '27%', cbd: '<1%', pricePerGram: 'ok. 70–75 zł/g', note: 'Segment 27% THC; ceny zależą od apteki' },
  ];
}

export type PharmacyStrain = {
  name: string;
  thcPercent: number;
  thcLabel: string;
  pricePerGram: number;
  priceLabel: string;
};

export type MedicalPharmacy = {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  /** Źródła orientacyjne: gdziepolek / ktomalek / kalkulatory cen */
  sources: string[];
  strains: PharmacyStrain[];
};

export type NearbyMedicalPharmacy = MedicalPharmacy & {
  distanceKm: number;
  strongest: PharmacyStrain;
  mapsUrl: string;
};

/** Orientacyjna baza aptek z MMJ (dane w stylu gdziepolek / ktomalek — sprawdzaj na żywo). */
const MEDICAL_PHARMACIES: MedicalPharmacy[] = [
  {
    id: 'szcz-dr-max-jasna',
    name: 'Apteka Dr.Max',
    address: 'ul. Jasna 12, 70-419 Szczecin',
    city: 'Szczecin',
    lat: 53.4289,
    lon: 14.553,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 68, priceLabel: '68 zł/g' },
      { name: 'Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 62, priceLabel: '62 zł/g' },
      { name: 'Farm Gas', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 58, priceLabel: '58 zł/g' },
    ],
  },
  {
    id: 'szcz-gemini-wyszyńskiego',
    name: 'Apteka Gemini',
    address: 'al. Wyzwolenia 50, 70-552 Szczecin',
    city: 'Szczecin',
    lat: 53.4325,
    lon: 14.5558,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Black Jelly', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 55, priceLabel: '55 zł/g' },
      { name: 'Aurora Pink Kush', thcPercent: 25, thcLabel: '25% THC', pricePerGram: 52, priceLabel: '52 zł/g' },
      { name: 'Pedanios 22/1', thcPercent: 22, thcLabel: '22% THC', pricePerGram: 48, priceLabel: '48 zł/g' },
    ],
  },
  {
    id: 'szcz-doz-galaxy',
    name: 'Apteka DOZ',
    address: 'ul. Niedziałkowskiego 24, 70-404 Szczecin',
    city: 'Szczecin',
    lat: 53.4262,
    lon: 14.5481,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 72, priceLabel: '72 zł/g' },
      { name: 'Canopy Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 65, priceLabel: '65 zł/g' },
      { name: 'Mac1', thcPercent: 24, thcLabel: '24% THC', pricePerGram: 50, priceLabel: '50 zł/g' },
    ],
  },
  {
    id: 'waw-drmax-zlote',
    name: 'Apteka Dr.Max Złote Tarasy',
    address: 'ul. Złota 59, 00-120 Warszawa',
    city: 'Warszawa',
    lat: 52.2298,
    lon: 21.0022,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 75, priceLabel: '75 zł/g' },
      { name: 'Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 70, priceLabel: '70 zł/g' },
      { name: 'Farm Gas', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 64, priceLabel: '64 zł/g' },
    ],
  },
  {
    id: 'waw-gemini-mokotow',
    name: 'Apteka Gemini',
    address: 'ul. Puławska 2, 02-566 Warszawa',
    city: 'Warszawa',
    lat: 52.2065,
    lon: 21.0218,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Black Jelly', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 60, priceLabel: '60 zł/g' },
      { name: 'Pedanios 22/1', thcPercent: 22, thcLabel: '22% THC', pricePerGram: 49, priceLabel: '49 zł/g' },
      { name: 'Aurora Delahaze', thcPercent: 21, thcLabel: '21% THC', pricePerGram: 46, priceLabel: '46 zł/g' },
    ],
  },
  {
    id: 'waw-cefarm-centrum',
    name: 'Apteka Cefarm',
    address: 'ul. Marszałkowska 104/122, 00-017 Warszawa',
    city: 'Warszawa',
    lat: 52.2297,
    lon: 21.0122,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 78, priceLabel: '78 zł/g' },
      { name: 'Canopy Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 72, priceLabel: '72 zł/g' },
      { name: 'Mac1', thcPercent: 24, thcLabel: '24% THC', pricePerGram: 54, priceLabel: '54 zł/g' },
    ],
  },
  {
    id: 'krk-drmax-galeria',
    name: 'Apteka Dr.Max',
    address: 'ul. Pawia 5, 31-154 Kraków',
    city: 'Kraków',
    lat: 50.0677,
    lon: 19.9456,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 70, priceLabel: '70 zł/g' },
      { name: 'Farm Gas', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 59, priceLabel: '59 zł/g' },
      { name: 'Pedanios 22/1', thcPercent: 22, thcLabel: '22% THC', pricePerGram: 47, priceLabel: '47 zł/g' },
    ],
  },
  {
    id: 'krk-gemini-bonarka',
    name: 'Apteka Gemini Bonarka',
    address: 'ul. Kamieńskiego 11, 30-644 Kraków',
    city: 'Kraków',
    lat: 50.0295,
    lon: 19.9572,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 66, priceLabel: '66 zł/g' },
      { name: 'Black Jelly', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 58, priceLabel: '58 zł/g' },
      { name: 'Mac1', thcPercent: 24, thcLabel: '24% THC', pricePerGram: 51, priceLabel: '51 zł/g' },
    ],
  },
  {
    id: 'wro-doz-renoma',
    name: 'Apteka DOZ',
    address: 'ul. Świdnicka 40, 50-072 Wrocław',
    city: 'Wrocław',
    lat: 51.1074,
    lon: 17.0325,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 73, priceLabel: '73 zł/g' },
      { name: 'Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 67, priceLabel: '67 zł/g' },
      { name: 'Farm Gas', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 61, priceLabel: '61 zł/g' },
    ],
  },
  {
    id: 'wro-gemini-magnolia',
    name: 'Apteka Gemini Magnolia',
    address: 'ul. Legnicka 58, 54-204 Wrocław',
    city: 'Wrocław',
    lat: 51.1228,
    lon: 16.9905,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Black Jelly', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 57, priceLabel: '57 zł/g' },
      { name: 'Pedanios 22/1', thcPercent: 22, thcLabel: '22% THC', pricePerGram: 48, priceLabel: '48 zł/g' },
      { name: 'Aurora Delahaze', thcPercent: 21, thcLabel: '21% THC', pricePerGram: 45, priceLabel: '45 zł/g' },
    ],
  },
  {
    id: 'poz-drmax-stary',
    name: 'Apteka Dr.Max',
    address: 'ul. Półwiejska 32, 61-888 Poznań',
    city: 'Poznań',
    lat: 52.4015,
    lon: 16.9282,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 69, priceLabel: '69 zł/g' },
      { name: 'Canopy Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 63, priceLabel: '63 zł/g' },
      { name: 'Mac1', thcPercent: 24, thcLabel: '24% THC', pricePerGram: 52, priceLabel: '52 zł/g' },
    ],
  },
  {
    id: 'gdn-gemini-forum',
    name: 'Apteka Gemini Forum',
    address: 'ul. Targ Rakowy 1, 80-855 Gdańsk',
    city: 'Gdańsk',
    lat: 54.3555,
    lon: 18.6472,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 71, priceLabel: '71 zł/g' },
      { name: 'Farm Gas', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 60, priceLabel: '60 zł/g' },
      { name: 'Pedanios 22/1', thcPercent: 22, thcLabel: '22% THC', pricePerGram: 49, priceLabel: '49 zł/g' },
    ],
  },
  {
    id: 'lod-doz-manufaktura',
    name: 'Apteka DOZ Manufaktura',
    address: 'ul. Drewnowska 58, 91-002 Łódź',
    city: 'Łódź',
    lat: 51.7794,
    lon: 19.4472,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Kush Mints', thcPercent: 28, thcLabel: '28% THC', pricePerGram: 64, priceLabel: '64 zł/g' },
      { name: 'Black Jelly', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 56, priceLabel: '56 zł/g' },
      { name: 'Mac1', thcPercent: 24, thcLabel: '24% THC', pricePerGram: 50, priceLabel: '50 zł/g' },
    ],
  },
  {
    id: 'kat-drmax-spodek',
    name: 'Apteka Dr.Max',
    address: 'al. Korfantego 35, 40-005 Katowice',
    city: 'Katowice',
    lat: 50.2661,
    lon: 19.0254,
    sources: ['gdziepolek.pl', 'ktomalek.pl'],
    strains: [
      { name: 'Aurora Sourdough', thcPercent: 29, thcLabel: '29% THC', pricePerGram: 74, priceLabel: '74 zł/g' },
      { name: 'Farm Gas', thcPercent: 27, thcLabel: '27% THC', pricePerGram: 62, priceLabel: '62 zł/g' },
      { name: 'Pedanios 22/1', thcPercent: 22, thcLabel: '22% THC', pricePerGram: 48, priceLabel: '48 zł/g' },
    ],
  },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function strongestStrain(strains: PharmacyStrain[]): PharmacyStrain {
  return [...strains].sort((a, b) => b.thcPercent - a.thcPercent || a.pricePerGram - b.pricePerGram)[0];
}

export function googleMapsRouteUrl(address: string): string {
  return `https://www.google.pl/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Trzy najbliższe apteki z MMJ względem lokalizacji użytkownika. */
export function getNearestMedicalPharmacies(
  lat: number,
  lon: number,
  count = 3,
): NearbyMedicalPharmacy[] {
  return MEDICAL_PHARMACIES.map((pharmacy) => {
    const strongest = strongestStrain(pharmacy.strains);
    return {
      ...pharmacy,
      distanceKm: haversineKm(lat, lon, pharmacy.lat, pharmacy.lon),
      strongest,
      mapsUrl: googleMapsRouteUrl(pharmacy.address),
    };
  })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export type AncientTree = {
  id: string;
  title: string;
  summary: string;
  ageHint: string | null;
  speciesHint: string | null;
  url: string;
  thumbnail: string | null;
};

/** Kandydaci do losowania — konkretne słynne drzewa (bez dwuznacznych haseł typu „Senator”). */
export const ANCIENT_TREE_QUERIES = [
  'Methuselah (drzewo)',
  'General Sherman',
  'Hyperion (drzewo)',
  'Prometeusz (drzewo)',
  'Dąb Bartek',
  'Dąb Chrobry',
  'Cis z Clervaux',
  'Oliwka z Vouves',
  'Jomon Sugi',
  'Cis z Llangernyw',
  'Fortingall Yew',
  'Tree of Ténéré',
  'Pando (klon)',
  'Árbol del Tule',
  'Drzewo Tule',
  'Gran Abuelo',
  'Old Tjikko',
  'Dąb Napoleona',
  'Dęby Rogalińskie',
  'Thimmamma Marrimanu',
  'Te Matua Ngahere',
  'Tāne Mahuta',
  'Major Oak',
  'Chestnut Tree of One Hundred Horses',
  'Centurion (eukaliptus)',
  'General Grant (drzewo)',
  'Dąb Dunin',
  'Baobab z Mahajangi',
];

/** Słowa botaniczne — WYŁĄCZNIE te liczą się jako sygnał „to drzewo”. */
const BOTANICAL_TREE_SIGNALS = [
  'drzewo',
  'drzewa',
  'drzewem',
  'drzewu',
  'dąb',
  'dębu',
  'dęby',
  'cis ',
  'cisa',
  'cisie',
  'sosna',
  'sosny',
  'sekwoja',
  'mamutowiec',
  'baobab',
  'oliwk',
  'wiąz',
  'miłorząb',
  'ginkgo',
  'jałowiec',
  'świerk',
  'kauri',
  'eukaliptus',
  'klon',
  'cypryś',
  'cyprys',
  'yew',
  'tree',
  'oak',
  'sequoia',
  'redwood',
  'modrzew',
  'buk ',
  'platan',
  'cedr',
  'żywotnik',
  'daglezja',
  'pomnik przyrody',
  'pień',
  'korona drzewa',
  'gatunek drzewa',
  'osobnik drzewa',
  'najstarsze drzewo',
  'największe drzewo',
];

const NON_TREE_TITLE_BLOCKLIST = [
  'japonia',
  'polska',
  'francja',
  'niemcy',
  'włochy',
  'hiszpania',
  'chiny',
  'indie',
  'australia',
  'kanada',
  'meksyk',
  'stany zjednoczone',
  'nowa zelandia',
  'grecja',
  'turcja',
  'egipt',
  'brazylia',
  'rosja',
  'wielka brytania',
  'europa',
  'azja',
  'afryka',
  'ameryka',
  'nelson mandela',
  'mandela',
];

/** Sygnały biografii / osoby / państwa — twarde odrzucenie. */
const PERSON_OR_PLACE_REJECT_SIGNALS = [
  'prezydent',
  'polityk',
  'polityczn',
  'działacz',
  'apartheid',
  'urodził się',
  'urodziła się',
  'ur. ',
  'zmarł ',
  'zmarła ',
  'zm. ',
  'noblista',
  'laureat nagrody nobla',
  'minister',
  'poseł',
  'senator', // osoba — nie drzewo „Senator”
  'aktor',
  'aktorka',
  'pisarz',
  'pisarka',
  'sportowiec',
  'piłkarz',
  'muzyk',
  'śpiewak',
  'król ',
  'królowa',
  'cesarz',
  'filozof',
  'naukowiec',
  'państwo wyspiarskie',
  'państwo położone',
  'republika południowej',
  'stolicą jest',
  'jednostka administracyjna',
  'kontynent',
  'monarchia',
  'south african',
  'anti-apartheid',
  'activist',
  'politician',
  'president of',
  'born ',
  'was a ',
  'was an ',
];

export type AncientTreeGateResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Protokół bramki „Prastare olbrzymy” — każdy artykuł musi przejść WSZYSTKIE kroki.
 * 1) Tytuł nie jest krajem / znaną osobą z blocklisty
 * 2) Opis/extract nie wygląda na biografię osoby ani hasło o państwie
 * 3) Jest jawny sygnał botaniczny (drzewo / dąb / oak / …) — NIE wystarczy samo „lat/wiek”
 * 4) Opcjonalnie: description z Wikipedii też nie może wskazywać na osobę
 */
export function runAncientTreeGateProtocol(input: {
  title: string;
  extract: string;
  description?: string | null;
  query?: string;
}): AncientTreeGateResult {
  const titleNorm = input.title.trim().toLowerCase();
  const extractNorm = input.extract.toLowerCase();
  const descriptionNorm = (input.description ?? '').toLowerCase();
  const haystack = `${titleNorm}\n${descriptionNorm}\n${extractNorm}`;
  const lead = `${titleNorm} ${descriptionNorm} ${extractNorm.slice(0, 320)}`.toLowerCase();

  // Krok 1 — blocklista tytułów
  if (
    NON_TREE_TITLE_BLOCKLIST.some(
      (name) => titleNorm === name || titleNorm.startsWith(`${name} (`) || titleNorm.includes(name),
    )
  ) {
    return { ok: false, reason: `Tytuł na blockliście: "${input.title}"` };
  }

  // Krok 2 — biografia / osoba / państwo w leadzie
  for (const signal of PERSON_OR_PLACE_REJECT_SIGNALS) {
    if (lead.includes(signal)) {
      // Wyjątek: „senator” w kontekście drzewa (hasło query zawiera drzewo)
      if (signal === 'senator' && /drzewo|tree|oak|dąb/i.test(input.query ?? '')) {
        continue;
      }
      return { ok: false, reason: `Sygnał osoby/państwa („${signal.trim()}”) w artykule „${input.title}”` };
    }
  }

  // Typowy wzorzec biografii PL: „X (ur. …)” lub „X – południowoafrykański …”
  if (
    /\(ur\.\s*\d/.test(input.extract) ||
    /\buzdrowi[łła]\b/i.test(input.extract) ||
    /\bpołudniowoafrykańsk/i.test(lead) ||
    /\bantyapartheidow/i.test(lead)
  ) {
    return { ok: false, reason: `Wygląda na biografię osoby: "${input.title}"` };
  }

  // Krok 3 — obowiązkowy sygnał botaniczny
  const hasBotanical = BOTANICAL_TREE_SIGNALS.some((word) => haystack.includes(word));
  if (!hasBotanical) {
    return { ok: false, reason: `Brak sygnału botanicznego w „${input.title}”` };
  }

  // Krok 4 — description Wikipedii nie może opisywać człowieka
  if (
    descriptionNorm &&
    /(polityk|prezydent|działacz|aktor|pisarz|sportowiec|muzyk|activist|politician|president)/i.test(
      descriptionNorm,
    )
  ) {
    return { ok: false, reason: `Description Wikipedii wskazuje osobę: "${input.description}"` };
  }

  return { ok: true };
}

/** @deprecated używaj runAncientTreeGateProtocol — zostawione tylko jako alias testowy */
export function looksLikeTreeArticle(
  title: string,
  extract: string,
  description?: string | null,
): boolean {
  return runAncientTreeGateProtocol({ title, extract, description }).ok;
}

function extractAgeHint(text: string): string | null {
  // Unikaj „lat” z biografii ludzkich — wymagaj kontekstu botanicznego w oknie wokół dopasowania
  const patterns = [
    /(\d[\d\s]*[\–\-]\d[\d\s]*)\s*(?:lat|roku|years?)/i,
    /(?:ok\.|około|okolo|около|approx\.?|about|ponad|over|mniej więcej)\s*(\d[\d\s]*)\s*(?:lat|roku|years?)/i,
    /(\d[\d\s]{2,})\s*(?:lat|roku|years?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || match.index == null) continue;
    const window = text.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80).toLowerCase();
    const botanicalNearby = BOTANICAL_TREE_SIGNALS.some((w) => window.includes(w));
    const personNearby = /(urodzi|zmarł|prezydent|polityk|działacz)/i.test(window);
    if (personNearby || !botanicalNearby) continue;

    const raw = (match[1] ?? match[0]).replace(/\s+/g, ' ').trim();
    if (/lat|roku|years/i.test(match[0])) return match[0].trim().slice(0, 60);
    return `ok. ${raw} lat`;
  }
  return null;
}

function extractSpeciesHint(title: string, text: string): string | null {
  const haystack = `${title}. ${text}`.toLowerCase();
  const species = [
    { key: 'sekwoja', label: 'sekwoja' },
    { key: 'mamutowiec', label: 'mamutowiec' },
    { key: 'sosna', label: 'sosna' },
    { key: 'dąb', label: 'dąb' },
    { key: 'cis', label: 'cis' },
    { key: 'oliwk', label: 'oliwka' },
    { key: 'baobab', label: 'baobab' },
    { key: 'cypryśnik', label: 'cypryśnik' },
    { key: 'wiąz', label: 'wiąz' },
    { key: 'miłorząb', label: 'miłorząb' },
    { key: 'ginkgo', label: 'miłorząb' },
    { key: 'jałowiec', label: 'jałowiec' },
    { key: 'świerk', label: 'świerk' },
    { key: 'kauri', label: 'kauri' },
    { key: 'eukaliptus', label: 'eukaliptus' },
    { key: 'klon', label: 'klon / Pando' },
    { key: 'oak', label: 'dąb' },
    { key: 'yew', label: 'cis' },
  ];

  for (const item of species) {
    if (haystack.includes(item.key)) return item.label;
  }
  return null;
}

async function fetchWikipediaSummaryPage(
  pageTitle: string,
): Promise<{
  title: string;
  extract: string;
  description: string | null;
  url: string;
  thumbnail: string | null;
  type?: string;
} | null> {
  const result = await fetchWithTimeout(
    `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
  );
  if (!result.ok || !result.response.ok) return null;

  const data = (await result.response.json()) as {
    title?: string;
    extract?: string;
    description?: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
    type?: string;
  };

  if (data.type === 'disambiguation') return null;

  const title = data.title ?? pageTitle;
  const extract = data.extract ?? '';
  if (!extract) return null;

  return {
    title,
    extract,
    description: data.description ?? null,
    url: data.content_urls?.desktop?.page ?? `https://pl.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    thumbnail: data.thumbnail?.source ?? null,
    type: data.type,
  };
}

function toAncientTreeFromPage(
  page: {
    title: string;
    extract: string;
    description: string | null;
    url: string;
    thumbnail: string | null;
  },
  query: string,
): AncientTree | { error: string } {
  const gate = runAncientTreeGateProtocol({
    title: page.title,
    extract: page.extract,
    description: page.description,
    query,
  });

  if (!gate.ok) {
    return { error: gate.reason };
  }

  return {
    id: page.title.toLowerCase().replace(/\s+/g, '-'),
    title: page.title,
    summary: page.extract.slice(0, 220) + (page.extract.length > 220 ? '…' : ''),
    ageHint: extractAgeHint(page.extract),
    speciesHint: extractSpeciesHint(page.title, page.extract),
    url: page.url,
    thumbnail: page.thumbnail,
  };
}

async function fetchWikipediaTreeByQuery(
  query: string,
): Promise<AncientTree | { error: string }> {
  const direct = await fetchWikipediaSummaryPage(query);
  if (direct) {
    const tree = toAncientTreeFromPage(direct, query);
    if (!('error' in tree)) return tree;
  }

  // Szukaj wyłącznie z wymuszeniem kontekstu botanicznego
  const searchQueries = [
    `${query} drzewo`,
    `"${query}" drzewo`,
    `${query} dąb OR oak OR tree OR sekwoja`,
  ];

  for (const srsearch of searchQueries) {
    const searchResult = await fetchWithTimeout(
      `https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        srsearch,
      )}&srlimit=10&format=json&origin=*`,
    );

    if (!searchResult.ok || !searchResult.response.ok) continue;

    const searchData = (await searchResult.response.json()) as {
      query?: { search?: Array<{ title: string; snippet?: string }> };
    };
    const candidates = searchData.query?.search ?? [];

    for (const candidate of candidates) {
      const snippet = (candidate.snippet ?? '').replace(/<[^>]+>/g, '').toLowerCase();
      // Szybki prefilter snippeta — odrzuć biografie zanim pobierzemy summary
      if (PERSON_OR_PLACE_REJECT_SIGNALS.some((s) => snippet.includes(s))) continue;
      if (!BOTANICAL_TREE_SIGNALS.some((s) => snippet.includes(s) || candidate.title.toLowerCase().includes(s.trim()))) {
        // snippet bez botaniki — i tak sprawdzimy summary, ale pomiń oczywiste osoby
        if (/\(ur\.|prezydent|polityk|działacz/i.test(snippet)) continue;
      }

      const page = await fetchWikipediaSummaryPage(candidate.title);
      if (!page) continue;
      const tree = toAncientTreeFromPage(page, query);
      if ('error' in tree) continue;
      return tree;
    }
  }

  return { error: `Brak wiarygodnego artykułu o drzewie dla "${query}"` };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Końcowa korekta listy — usuwa wpadki, które jakoś przeszły wcześniej. */
export function correctAncientTreeList(trees: AncientTree[]): AncientTree[] {
  const seen = new Set<string>();
  const cleaned: AncientTree[] = [];

  for (const tree of trees) {
    const gate = runAncientTreeGateProtocol({
      title: tree.title,
      extract: tree.summary,
      description: null,
    });
    if (!gate.ok) continue;
    const key = tree.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(tree);
  }

  return cleaned;
}

/** Losuje jedno drzewo z Wikipedii, unikając już pokazanych tytułów. */
export async function fetchRandomAncientTree(
  excludeTitles: string[] = [],
): Promise<AncientTree | { error: string }> {
  const excluded = new Set(excludeTitles.map((t) => t.toLowerCase()));
  const pool = shuffle(ANCIENT_TREE_QUERIES);

  for (const query of pool) {
    const result = await fetchWikipediaTreeByQuery(query);
    if ('error' in result) continue;
    if (excluded.has(result.title.toLowerCase())) continue;
    // Druga bramka tuż przed zwróceniem
    const gate = runAncientTreeGateProtocol({
      title: result.title,
      extract: result.summary,
    });
    if (!gate.ok) continue;
    return result;
  }

  return { error: 'Nie udało się wylosować nowego drzewa z Wikipedii' };
}

/** Pobiera początkowe 3 drzewa z Wikipedii. */
export async function fetchInitialAncientTrees(count = 3): Promise<AncientTree[]> {
  const trees: AncientTree[] = [];
  const pool = shuffle(ANCIENT_TREE_QUERIES);

  for (const query of pool) {
    if (trees.length >= count) break;
    const result = await fetchWikipediaTreeByQuery(query);
    if ('error' in result) continue;
    if (trees.some((t) => t.title.toLowerCase() === result.title.toLowerCase())) continue;
    trees.push(result);
  }

  return correctAncientTreeList(trees);
}
