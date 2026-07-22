import { getToolName, isToolUIPart, type UIMessage } from 'ai';

export type ToolErrorEntry = {
  toolName: string;
  args: string;
  message: string;
};

export const TOOL_EMOJI: Record<string, string> = {
  calculator: '🧮',
  currentDateTime: '🕐',
  getWeather: '🌤️',
  getShortSleeveForecast: '👕',
  getExchangeRate: '💱',
  getHolidays: '📅',
  searchWikipedia: '📚',
  saveNote: '📝',
  getNotes: '📋',
  readWebPage: '📄',
  generateImage: '🎨',
  google_search: '🌐',
};

export function getToolEmoji(toolName: string) {
  return TOOL_EMOJI[toolName] ?? '🔧';
}

export function getToolParts(parts: UIMessage['parts']) {
  return parts.filter((part) => isToolUIPart(part));
}

export function countToolParts(parts: UIMessage['parts']) {
  return getToolParts(parts).filter((part) => part.state === 'output-available').length;
}

export function hasToolError(output: unknown): boolean {
  if (typeof output === 'object' && output !== null && 'error' in output) {
    return Boolean((output as { error?: string }).error);
  }

  if (typeof output === 'string') {
    return /błąd|timeout|nie znalaz|nie udało|niedozwolone|nie mogę|przekroczono/i.test(output);
  }

  return false;
}

export function getToolErrorMessage(output: unknown): string | null {
  if (typeof output === 'object' && output !== null && 'error' in output) {
    const message = (output as { error?: string }).error;
    return message ?? null;
  }

  if (typeof output === 'string' && hasToolError(output)) {
    return output;
  }

  return null;
}

export function getToolUsageCounts(parts: UIMessage['parts']) {
  const counts: Record<string, number> = {};

  for (const part of getToolParts(parts)) {
    if (part.state !== 'output-available') continue;
    const name = getToolName(part);
    counts[name] = (counts[name] ?? 0) + 1;
  }

  return counts;
}

export function countToolErrors(parts: UIMessage['parts']) {
  return collectToolErrors(parts).length;
}

export function collectToolErrors(parts: UIMessage['parts']): ToolErrorEntry[] {
  const errors: ToolErrorEntry[] = [];

  for (const part of getToolParts(parts)) {
    if (part.state !== 'output-available') continue;

    const message = getToolErrorMessage(part.output);
    if (!message) continue;

    errors.push({
      toolName: getToolName(part),
      args: formatToolArgs(getToolName(part), part.input),
      message,
    });
  }

  return errors;
}

export function formatToolArgs(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';

  const args = input as Record<string, unknown>;

  if (toolName === 'calculator' && typeof args.expression === 'string') {
    return `"${args.expression}"`;
  }
  if (toolName === 'readWebPage' && typeof args.url === 'string') {
    return `(${args.url})`;
  }
  if (toolName === 'generateImage' && typeof args.prompt === 'string') {
    const short = args.prompt.length > 40 ? `${args.prompt.slice(0, 40)}...` : args.prompt;
    return `("${short}")`;
  }
  if (toolName === 'getWeather' && typeof args.city === 'string') {
    return `("${args.city}")`;
  }
  if (toolName === 'getShortSleeveForecast' && typeof args.city === 'string') {
    const days = typeof args.days === 'number' ? `, ${args.days}d` : '';
    return `("${args.city}"${days})`;
  }
  if (toolName === 'getExchangeRate' && typeof args.currency === 'string') {
    return `(${args.currency})`;
  }
  if (toolName === 'getHolidays') {
    const country = typeof args.countryCode === 'string' ? args.countryCode : '';
    const year = typeof args.year === 'number' ? args.year : '';
    return `(${country}, ${year})`;
  }
  if (toolName === 'searchWikipedia' && typeof args.query === 'string') {
    return `("${args.query}")`;
  }
  if (toolName === 'saveNote' && typeof args.title === 'string') {
    return `("${args.title}")`;
  }

  return '';
}

export function summarizeToolOutput(toolName: string, output: unknown): string {
  if (!output) return 'Brak wyniku';

  if (toolName === 'calculator' && typeof output === 'object' && output !== null) {
    const data = output as { expression?: string; result?: number; error?: string };
    if (data.error) return data.error;
    return `= ${data.result}`;
  }

  if (toolName === 'currentDateTime' && typeof output === 'object' && output !== null) {
    const data = output as { dateTime?: string; dayOfWeek?: string };
    return `${data.dayOfWeek}, ${data.dateTime}`;
  }

  if (toolName === 'readWebPage' && typeof output === 'object' && output !== null) {
    const data = output as { content?: string; error?: string };
    if (data.error) return data.error;
    const content = data.content ?? '';
    return content.length > 120 ? `${content.slice(0, 120)}...` : content;
  }

  if (toolName === 'readWebPage' && typeof output === 'string') {
    return output.length > 120 ? `${output.slice(0, 120)}...` : output;
  }

  if (toolName === 'generateImage' && typeof output === 'object' && output !== null) {
    const data = output as { text?: string; image?: string };
    return data.text || 'Obraz wygenerowany';
  }

  if (toolName === 'google_search') {
    return 'Wyniki z Google';
  }

  if (toolName === 'getWeather' && typeof output === 'object' && output !== null) {
    const data = output as {
      error?: string;
      city?: string;
      temperature?: string;
      description?: string;
    };
    if (data.error) return data.error;
    return `${data.city}: ${data.temperature}, ${data.description}`;
  }

  if (toolName === 'getShortSleeveForecast' && typeof output === 'object' && output !== null) {
    const data = output as {
      error?: string;
      shortSleevePossible?: boolean;
      slots?: unknown[];
      message?: string;
    };
    if (data.error) return data.error;
    if (data.shortSleevePossible) {
      return `${data.slots?.length ?? 0} przedziałów 25–39°C`;
    }
    return data.message ?? 'Brak pogody na krótki rękawek';
  }

  if (toolName === 'getExchangeRate' && typeof output === 'object' && output !== null) {
    const data = output as { error?: string; currency?: string; rate?: number; date?: string };
    if (data.error) return data.error;
    return `1 ${data.currency} = ${data.rate} PLN (${data.date})`;
  }

  if (toolName === 'getHolidays' && Array.isArray(output)) {
    return `${output.length} świąt`;
  }

  if (toolName === 'getHolidays' && typeof output === 'object' && output !== null && 'error' in output) {
    return String((output as { error: string }).error);
  }

  if (toolName === 'searchWikipedia' && typeof output === 'object' && output !== null) {
    const data = output as { error?: string; title?: string; summary?: string };
    if (data.error) return data.error;
    const summary = data.summary ?? '';
    return `${data.title}: ${summary.slice(0, 80)}${summary.length > 80 ? '...' : ''}`;
  }

  if (toolName === 'saveNote' && typeof output === 'object' && output !== null) {
    const data = output as { saved?: boolean; title?: string };
    return data.saved ? `Zapisano: ${data.title}` : 'Nie zapisano';
  }

  if (toolName === 'getNotes' && Array.isArray(output)) {
    return `${output.length} notatek`;
  }

  if (typeof output === 'string') {
    return output.length > 120 ? `${output.slice(0, 120)}...` : output;
  }

  return JSON.stringify(output).slice(0, 120);
}

export function getGenerateImageFromParts(parts: UIMessage['parts']) {
  for (const part of parts) {
    if (!isToolUIPart(part)) continue;
    if (getToolName(part) !== 'generateImage') continue;
    if (part.state !== 'output-available') continue;

    const output = part.output as { image?: string } | undefined;
    if (output?.image) return output.image;
  }

  return null;
}
