const NAMED_KEY_VARS = [
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY_2',
  'GOOGLE_GENERATIVE_AI_API_KEY_3',
  'GOOGLE_GENERATIVE_AI_API_KEY_4',
] as const;

function addUniqueKey(keys: string[], seen: Set<string>, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  keys.push(trimmed);
}

export function getGoogleApiKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const name of NAMED_KEY_VARS) {
    addUniqueKey(keys, seen, process.env[name]);
  }

  const multi = process.env.GOOGLE_API_KEYS;
  if (multi) {
    for (const part of multi.split(',')) {
      addUniqueKey(keys, seen, part);
    }
  }

  return keys;
}

export function getPrimaryGoogleApiKey(): string | undefined {
  return getGoogleApiKeys()[0];
}
