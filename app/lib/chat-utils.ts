import type { UIMessage } from 'ai';

export type ChatModel = 'flash' | 'pro';

export type ResponseMode = 'short' | 'detail' | 'optimist' | 'pesimist';

export type MessageMetadata = {
  model?: ChatModel;
  responseMode?: ResponseMode | null;
};

export function getMessageText(parts: { type: string; text?: string }[]) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('');
}

export function getAssistantModel(
  messages: UIMessage[],
  messageIndex: number,
): ChatModel {
  for (let i = messageIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const metadata = messages[i].metadata as MessageMetadata | undefined;
      return metadata?.model ?? 'flash';
    }
  }

  return 'flash';
}

export function estimateTokens(messages: UIMessage[]) {
  const characters = messages.reduce((total, message) => {
    return total + getMessageText(message.parts).length;
  }, 0);

  return Math.ceil(characters / 4);
}

export function formatConversationForExport(messages: UIMessage[]) {
  return messages
    .map((message) => {
      const role = message.role === 'user' ? 'User' : 'Agent';
      return `${role}: ${getMessageText(message.parts)}`;
    })
    .join('\n');
}

export const MODEL_OPTIONS: {
  id: ChatModel;
  label: string;
  emoji: string;
}[] = [
  { id: 'flash', label: 'Flash Lite', emoji: '⚡' },
  { id: 'pro', label: 'Flash Lite', emoji: '⚡' },
];

export const RESPONSE_MODE_BADGES: Record<
  ResponseMode,
  { label: string; emoji: string }
> = {
  short: { label: 'Hot take', emoji: '⚡' },
  detail: { label: 'Deep dive', emoji: '🔬' },
  optimist: { label: 'Hype', emoji: '🚀' },
  pesimist: { label: 'Skeptyk', emoji: '🤔' },
};

export function getAssistantResponseMode(
  messages: UIMessage[],
  messageIndex: number,
): ResponseMode | null {
  for (let i = messageIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const metadata = messages[i].metadata as MessageMetadata | undefined;
      return metadata?.responseMode ?? null;
    }
  }

  return null;
}

export const MODEL_BADGES: Record<
  ChatModel,
  { label: string; emoji: string }
> = {
  flash: { label: 'flash-lite', emoji: '⚡' },
  pro: { label: 'flash-lite', emoji: '⚡' },
};
