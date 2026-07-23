import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/app/lib/supabase';
import type { Database, Json, UserProfileRow } from '@/app/lib/supabase-types';

type DbClient = SupabaseClient<Database>;

function db(client?: DbClient | null): DbClient | null {
  return client ?? getSupabase();
}

export const USER_ID_STORAGE_KEY = 'user_id';

const NAME_TOKEN = '([A-Za-zÀ-ÖØ-öø-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻż]{2,30})';

const BLOCKED_NAMES = new Set(
  [
    'tu',
    'tutaj',
    'gotowy',
    'gotowa',
    'ciekawy',
    'ciekawa',
    'glodny',
    'głodny',
    'glodna',
    'głodna',
    'ok',
    'okej',
    'hej',
    'czesc',
    'cześć',
    'hello',
    'hi',
  ].map((s) => s.toLowerCase()),
);

/** Wyciąga imię z wiadomości typu „Mam na imię Kamil” / „Jestem Anna” / samo „Paweł”. */
export function extractNameFromMessage(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 120) return null;

  const patterns: RegExp[] = [
    new RegExp(`mam na imi[eę]\\s+${NAME_TOKEN}`, 'i'),
    new RegExp(`nazywam si[eę]\\s+${NAME_TOKEN}`, 'i'),
    new RegExp(`^imie[:\\s]+${NAME_TOKEN}`, 'i'),
    new RegExp(`^imię[:\\s]+${NAME_TOKEN}`, 'i'),
    new RegExp(`moje imi[eę] to\\s+${NAME_TOKEN}`, 'i'),
    new RegExp(`^to\\s+${NAME_TOKEN}\\.?$`, 'i'),
    new RegExp(`^jestem\\s+${NAME_TOKEN}\\.?$`, 'i'),
    new RegExp(`^${NAME_TOKEN}\\.?$`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    if (BLOCKED_NAMES.has(raw.toLowerCase())) continue;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return null;
}

/** localStorage user_id — legacy; preferuj auth.uid() z useAuth / getAuthUserId. */
export function readOrCreateBrowserUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_STORAGE_KEY);
}

/** Ustawia user_id w localStorage na auth.uid() (spójność z API). */
export function syncBrowserUserId(authUserId: string): void {
  if (typeof window === 'undefined' || !authUserId) return;
  localStorage.setItem(USER_ID_STORAGE_KEY, authUserId);
}

export async function getUserProfile(
  userId: string,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const supabase = db(client);
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getUserProfile', error.message);
    return null;
  }
  return data;
}

export async function getOrCreateUserProfile(
  userId: string,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const existing = await getUserProfile(userId, client);
  if (existing) return existing;

  const supabase = db(client);
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ id: userId, name: null, preferences: {} })
    .select()
    .single();

  if (error) {
    // Wyścig: ktoś już utworzył rekord
    const again = await getUserProfile(userId, client);
    if (again) return again;
    console.error('getOrCreateUserProfile', error.message);
    return null;
  }
  return data;
}

/** Klient: profil = auth.uid() (nie losowy UUID). */
export async function ensureBrowserUserProfile(
  authUserId?: string | null,
): Promise<UserProfileRow | null> {
  const userId = authUserId ?? readOrCreateBrowserUserId();
  if (!userId) return null;
  syncBrowserUserId(userId);
  const profile = await getOrCreateUserProfile(userId);
  if (!profile) return null;
  return repairProfilePreferences(profile);
}

/** Poprawia stare błędy w preferences (Szczecinie → Szczecin, jeść → usuń). */
async function repairProfilePreferences(
  profile: UserProfileRow,
): Promise<UserProfileRow> {
  const supabase = getSupabase();
  if (!supabase) return profile;
  if (!profile.preferences || typeof profile.preferences !== 'object' || Array.isArray(profile.preferences)) {
    return profile;
  }

  const current = { ...(profile.preferences as Record<string, Json>) };
  let changed = false;

  if (typeof current.miasto === 'string') {
    const fixed = normalizeCity(current.miasto);
    if (fixed !== current.miasto) {
      current.miasto = fixed;
      changed = true;
    }
  }

  if (typeof current.ulubione_jedzenie === 'string') {
    const food = normalizeFood(current.ulubione_jedzenie);
    if (!food) {
      delete current.ulubione_jedzenie;
      changed = true;
    } else if (food !== current.ulubione_jedzenie) {
      // np. „Zamień rekord na pizza” → pizza
      current.ulubione_jedzenie = food;
      changed = true;
    }
  }

  if (!changed) return profile;

  const { data, error } = await supabase
    .from('user_profiles')
    .update({ preferences: current })
    .eq('id', profile.id)
    .select()
    .single();

  if (error || !data) {
    console.error('repairProfilePreferences', error?.message);
    return { ...profile, preferences: current };
  }
  return data;
}

export async function updateUserName(
  userId: string,
  name: string,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const supabase = db(client);
  if (!supabase || !userId) return null;

  const extracted = extractNameFromMessage(name);
  const cleaned = (extracted ?? name).replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) {
    console.error('updateUserName', 'puste lub niepoprawne imię', { name });
    return null;
  }
  const displayName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Upsert — działa też gdy brak wiersza / RLS / wyścig create+update
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      { id: userId, name: displayName },
      { onConflict: 'id' },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('updateUserName', error.message, { userId, code: error.code });
    return null;
  }
  if (!data) {
    console.error('updateUserName', 'brak wiersza po upsert', { userId });
    return null;
  }
  return data;
}

/** Zapisuje imię z treści wiadomości użytkownika (fallback gdy model nie wywoła toola). */
export async function maybeSaveNameFromUserText(
  userId: string,
  text: string,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const existing = await getUserProfile(userId, client);
  if (existing?.name?.trim()) return existing;

  const extracted = extractNameFromMessage(text);
  if (!extracted) return existing;

  return updateUserName(userId, extracted, client);
}

const FOOD_HINT =
  /\b(pizz[aeę]|sushi|burger[y]?|kebab[a]?|pasta|makaron|pierogi|nale[sś]niki|zupa|tacos[y]?|ramen|pho|stek|frytki|lody|czekolada|kawa|herbata|risotto|curry|shawarma|hummus|sa[lł]atk[aei]|kanapk[aei]|schabowy|kotlet|bigos|gołąbki|golabki|zapiekanka|gyro|falafel|spaghetti|lasagne|lasagna|carbonara|margherita|hawajsk[aą]|pepperoni)\b/i;

const FOOD_CANONICAL: Record<string, string> = {
  pizza: 'pizza',
  pizze: 'pizza',
  pizzę: 'pizza',
  sushi: 'sushi',
  burger: 'burger',
  burgery: 'burgery',
  kebab: 'kebab',
  kebaba: 'kebab',
  pasta: 'pasta',
  makaron: 'makaron',
  pierogi: 'pierogi',
  spaghetti: 'spaghetti',
  lasagne: 'lasagne',
  lasagna: 'lasagne',
};

const BLOCKED_FOOD_SUBSTRINGS = [
  'zamień',
  'zamien',
  'zgadza',
  'udało',
  'udalo',
  'zapis',
  'rekord',
  'preferenc',
  'narzęd',
  'tool',
  'saveuser',
  'ulubione_jedzenie',
  'mieszkam',
  'przypomnij',
  'powiedz',
  'napisz',
];

const LOCATIVE_TO_NOMINATIVE: Record<string, string> = {
  szczecinie: 'Szczecin',
  krakowie: 'Kraków',
  warszawie: 'Warszawa',
  wrocławiu: 'Wrocław',
  wroclawiu: 'Wrocław',
  poznaniu: 'Poznań',
  gdańsku: 'Gdańsk',
  gdansku: 'Gdańsk',
  łodzi: 'Łódź',
  lodzi: 'Łódź',
  katowicach: 'Katowice',
  lublinie: 'Lublin',
  bydgoszczy: 'Bydgoszcz',
};

export type ExtractedPreferences = Partial<{
  miasto: string;
  ulubione_jedzenie: string;
  hobby: string;
}>;

function cleanPrefValue(raw: string): string {
  return raw
    .replace(/["'`]/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function normalizeCity(raw: string): string {
  const city = cleanPrefValue(raw);
  return (
    LOCATIVE_TO_NOMINATIVE[city.toLowerCase()] ??
    city.replace(/^./, (c) => c.toUpperCase())
  );
}

/**
 * Akceptuje TYLKO realne nazwy dań.
 * Odrzuca zdania, komendy modelu, „Zgadza się…”, „Zamień rekord…”.
 * Jeśli w śmieciach jest „pizza” — wyciąga samą pizzę.
 */
function normalizeFood(raw: string): string | null {
  const cleaned = cleanPrefValue(raw);
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();

  // Komendy / zdania modelu — śmieci (chyba że da się wyciągnąć znane danie)
  const looksLikeGarbage =
    cleaned.length > 28 ||
    cleaned.split(/\s+/).length > 4 ||
    /[:=]/.test(cleaned) ||
    BLOCKED_FOOD_SUBSTRINGS.some((s) => lower.includes(s));

  const hint = cleaned.match(FOOD_HINT);
  if (hint?.[0]) {
    const token = hint[0].toLowerCase();
    return FOOD_CANONICAL[token] ?? token.charAt(0).toUpperCase() + token.slice(1);
  }

  if (looksLikeGarbage) return null;

  // Krótka nazwa bez hitów ze słownika — tylko 1–2 słowa, same litery
  if (
    cleaned.split(/\s+/).length <= 2 &&
    /^[A-Za-zÀ-ÖØ-öø-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻż\s\-]+$/.test(cleaned) &&
    cleaned.length >= 3 &&
    cleaned.length <= 24
  ) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  return null;
}

export type ExtractPreferenceOptions = {
  /** Ostatnia wiadomość asystenta pytała o jedzenie — krótką odpowiedź z nazwą dania zapisz. */
  treatShortReplyAsFood?: boolean;
};

/** Wyciąga miasto / jedzenie / hobby z wiadomości (W3 bonus — niezawodny fallback). */
export function extractPreferencesFromMessage(
  text: string,
  options: ExtractPreferenceOptions = {},
): ExtractedPreferences {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 280) return {};

  const out: ExtractedPreferences = {};
  const cityName = '([A-Za-zÀ-ÖØ-öø-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻż][A-Za-zÀ-ÖØ-öø-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻż\\-\\s]{1,40})';

  const cityMatch =
    t.match(new RegExp(`mieszkam w\\s+${cityName}`, 'i')) ||
    t.match(new RegExp(`jestem z\\s+${cityName}`, 'i')) ||
    t.match(new RegExp(`pochodz[eę] z\\s+${cityName}`, 'i')) ||
    t.match(new RegExp(`moje miasto to\\s+${cityName}`, 'i')) ||
    t.match(new RegExp(`mieszkam\\s+(?:w|we)\\s+${cityName}`, 'i'));

  if (cityMatch?.[1]) {
    out.miasto = normalizeCity(cityMatch[1]);
  }

  // Tylko jawne wzorce o jedzeniu + znane dania (nigdy dowolne zdanie)
  const foodMatch =
    t.match(/ulubione (?:jedzenie|danie)(?:\s+to)?\s+([^.!?,]+)/i) ||
    t.match(/moje ulubione (?:danie|jedzenie) to\s+([^.!?,]+)/i) ||
    t.match(/najch[eę]tniej jem\s+([^.!?,]+)/i) ||
    t.match(/lubi[eę] je[sś][cć]\s+([^.!?,]+)/i) ||
    t.match(/lubi[eę]\s+(pizz[aeę]|sushi|burger[y]?|kebab[a]?|pierogi|makaron|pasta)\b/i);

  if (foodMatch) {
    const rawFood = foodMatch[1] ?? foodMatch[0]?.replace(/^lubi[eę]\s+/i, '') ?? '';
    const value = normalizeFood(rawFood);
    if (value) out.ulubione_jedzenie = value;
  }

  // Sama „pizza” / „Sushi” (także gdy agent pytał o danie)
  if (!out.ulubione_jedzenie) {
    const bare = cleanPrefValue(t);
    const wordCount = bare.split(/\s+/).length;
    if (
      wordCount <= 3 &&
      FOOD_HINT.test(bare) &&
      !/mieszkam|nazywam|mam na imi|zamień|zgadza/i.test(bare)
    ) {
      const food = normalizeFood(bare);
      if (food) out.ulubione_jedzenie = food;
    } else if (options.treatShortReplyAsFood && wordCount <= 3) {
      // Tylko jeśli wygląda na nazwę dania (normalizeFood odrzuci śmieci)
      const food = normalizeFood(bare);
      if (food && FOOD_HINT.test(food)) out.ulubione_jedzenie = food;
    }
  }

  const hobbyMatch =
    t.match(/moje hobby to\s+([^.!?,]+)/i) ||
    t.match(/interesuj[eę] si[eę]\s+([^.!?,]+)/i);

  if (hobbyMatch?.[1] && !out.hobby) {
    const hobby = cleanPrefValue(hobbyMatch[1]);
    if (hobby.length <= 40 && !BLOCKED_FOOD_SUBSTRINGS.some((s) => hobby.toLowerCase().includes(s))) {
      out.hobby = hobby;
    }
  }

  return out;
}

export async function updateUserPreferencesBatch(
  userId: string,
  prefs: ExtractedPreferences,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const entries = Object.entries(prefs).filter(([, v]) => typeof v === 'string' && v.trim());
  if (entries.length === 0) return getUserProfile(userId, client);

  let profile: UserProfileRow | null = null;
  for (const [key, value] of entries) {
    profile = await updateUserPreference(userId, key, value as string, client);
  }
  return profile;
}

/** Zapisuje preferencje wykryte w tekście (miasto, jedzenie, hobby). */
export async function maybeSavePreferencesFromUserText(
  userId: string,
  text: string,
  options?: ExtractPreferenceOptions,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const extracted = extractPreferencesFromMessage(text, options);
  if (Object.keys(extracted).length === 0) return getUserProfile(userId, client);
  return updateUserPreferencesBatch(userId, extracted, client);
}

export function assistantAskedAboutFood(assistantText: string): boolean {
  return /ulubion|jedzen|danie|pizzer|co\s+lubisz\s+je[sś][cć]|co\s+jesz/i.test(
    assistantText,
  );
}

/** Imię + preferencje z jednej wiadomości użytkownika (API + klient). */
export async function hydrateUserProfileFromMessage(
  userId: string,
  text: string,
  options?: ExtractPreferenceOptions,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  await maybeSaveNameFromUserText(userId, text, client);
  const withPrefs = await maybeSavePreferencesFromUserText(userId, text, options, client);
  return withPrefs ?? getOrCreateUserProfile(userId, client);
}

/** Skrót preferencji do UI (miasto, jedzenie, hobby). */
export function formatPreferencesShort(preferences: Json | null | undefined): string {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return '';
  }
  const p = preferences as Record<string, Json>;
  const bits: string[] = [];
  if (typeof p.miasto === 'string' && p.miasto.trim()) bits.push(`📍 ${p.miasto.trim()}`);
  if (typeof p.ulubione_jedzenie === 'string' && p.ulubione_jedzenie.trim()) {
    const food = normalizeFood(p.ulubione_jedzenie);
    if (food) bits.push(`🍕 ${food}`);
  }
  if (typeof p.hobby === 'string' && p.hobby.trim()) bits.push(`🎯 ${p.hobby.trim()}`);
  return bits.join(' · ');
}

export async function updateUserPreference(
  userId: string,
  key: string,
  value: string,
  client?: DbClient | null,
): Promise<UserProfileRow | null> {
  const supabase = db(client);
  if (!supabase) return null;

  let normalized = cleanPrefValue(value);
  if (key === 'miasto') normalized = normalizeCity(normalized);
  if (key === 'ulubione_jedzenie') {
    const food = normalizeFood(normalized);
    if (!food) return getUserProfile(userId, client);
    normalized = food;
  }
  if (!normalized) return getUserProfile(userId, client);

  const profile = await getOrCreateUserProfile(userId, client);
  if (!profile) return null;

  const current =
    profile.preferences && typeof profile.preferences === 'object' && !Array.isArray(profile.preferences)
      ? (profile.preferences as Record<string, Json>)
      : {};

  const nextPrefs: Json = {
    ...current,
    [key]: normalized,
  };

  // Napraw stare błędne wartości miasta przy okazji zapisu
  if (
    key !== 'miasto' &&
    typeof current.miasto === 'string' &&
    LOCATIVE_TO_NOMINATIVE[current.miasto.toLowerCase()]
  ) {
    (nextPrefs as Record<string, Json>).miasto =
      LOCATIVE_TO_NOMINATIVE[current.miasto.toLowerCase()];
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({ preferences: nextPrefs })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('updateUserPreference', error.message);
    return null;
  }
  return data;
}

export function formatPreferences(preferences: Json | null | undefined): string {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return '';
  }
  const p = preferences as Record<string, Json>;
  const bits: string[] = [];
  if (typeof p.miasto === 'string' && p.miasto.trim()) {
    bits.push(`miasto: ${normalizeCity(p.miasto)}`);
  }
  if (typeof p.ulubione_jedzenie === 'string' && p.ulubione_jedzenie.trim()) {
    const food = normalizeFood(p.ulubione_jedzenie);
    if (food) bits.push(`ulubione_jedzenie: ${food}`);
  }
  if (typeof p.hobby === 'string' && p.hobby.trim()) {
    bits.push(`hobby: ${p.hobby.trim()}`);
  }
  return bits.join('; ');
}

export function buildPersonalizationPrompt(
  profile: Pick<UserProfileRow, 'name' | 'preferences'> | null,
): string {
  // W bazie kolumna to `name` (= display_name z warsztatu W4)
  const displayName = profile?.name?.trim() || null;
  const prefs = formatPreferences(profile?.preferences);

  const conversationRules = `
## ZASADY ROZMOWY (OBOWIĄZKOWE)
- Na KAŻDĄ wiadomość użytkownika ZAWSZE odpowiadaj tekstem — NIGDY nie milcz.
- Po użyciu narzędzia (saveUserName / saveUserPreference) i tak NAPISZ odpowiedź użytkownikowi.
- Gdy użytkownik poda imię — potwierdź: „Miło Cię poznać, {imię}! Zapamiętam.” i kontynuuj.
- Gdy użytkownik poda fakt o sobie (miasto, jedzenie, hobby) — potwierdź krótko, zapamiętaj i zadaj 1 naturalne pytanie kontynuujące.
- Prowadź żywą rozmowę, nie kończ na samym „OK, zapisałem”.`;

  if (displayName) {
    return `

## PERSONALIZACJA UŻYTKOWNIKA
Rozmawiasz z użytkownikiem: ${displayName}.
Zwracaj się do niego po imieniu (np. „Cześć, ${displayName}!”).
Bądź ciepły i personalny — to Twój stały użytkownik.
${prefs ? `Znane preferencje: ${prefs}. UWZGLĘDNIAJ je w radach.` : 'Nie znamy jeszcze miasta ani ulubionego jedzenia — jeśli poda, zapisz.'}
Gdy użytkownik poda miasto — saveUserPreference(key: "miasto", value: "...") i zapytaj dalej o szczegóły.
Gdy poda ulubione jedzenie — saveUserPreference(key: "ulubione_jedzenie", value: "...").
Gdy poda hobby — saveUserPreference(key: "hobby", value: "...").
${conversationRules}`;
  }

  return `

## PERSONALIZACJA UŻYTKOWNIKA
Rozmawiasz z użytkownikiem: nieznany (display_name = null).
Jeśli nie znasz imienia — zapytaj grzecznie na początku rozmowy.
Gdy użytkownik poda imię („Jestem Paweł”, „Mam na imię Ewa”) — NATYCHMIAST saveUserName z samym imieniem, potem: „Miło Cię poznać, {imię}! Zapamiętam.”
${prefs ? `Już znamy preferencje: ${prefs}.` : ''}
Gdy poda miasto — saveUserPreference(key: "miasto", value: "...").
Gdy poda ulubione jedzenie — saveUserPreference(key: "ulubione_jedzenie", value: "...").
${conversationRules}`;
}
