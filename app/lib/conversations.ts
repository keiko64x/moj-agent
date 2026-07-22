import { getSupabase } from '@/app/lib/supabase';
import type { ConversationRow, MessageRow } from '@/app/lib/supabase-types';
import type { UIMessage } from 'ai';

/** Skraca pierwszą wiadomość użytkownika do tytułu rozmowy (max 50 znaków). */
export function makeConversationTitle(text: string, max = 50): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function dbMessagesToUIMessages(rows: MessageRow[]): UIMessage[] {
  return rows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: row.content }],
    }));
}

/** Usuwa kolejne identyczne wiadomości asystenta (np. podwójne powitanie). */
export function dedupeConsecutiveAssistantRows(rows: MessageRow[]): MessageRow[] {
  const out: MessageRow[] = [];
  for (const row of rows) {
    const prev = out.at(-1);
    if (
      prev &&
      prev.role === 'assistant' &&
      row.role === 'assistant' &&
      prev.content.trim() === row.content.trim()
    ) {
      continue;
    }
    out.push(row);
  }
  return out;
}

export function dedupeConsecutiveAssistantUIMessages(messages: UIMessage[]): UIMessage[] {
  const out: UIMessage[] = [];
  for (const message of messages) {
    const prev = out.at(-1);
    if (prev?.role === 'assistant' && message.role === 'assistant') {
      const prevText = prev.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')
        .trim();
      const nextText = message.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')
        .trim();
      if (prevText && prevText === nextText) continue;
    }
    out.push(message);
  }
  return out;
}

export async function createConversation(title?: string): Promise<ConversationRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ title: title ?? 'Nowa rozmowa', updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error('createConversation', error.message);
    return null;
  }
  return data;
}

export async function touchConversation(conversationId: string, title?: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const patch: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };
  if (title) patch.title = title;

  const { error } = await supabase.from('conversations').update(patch).eq('id', conversationId);
  if (error) console.error('touchConversation', error.message);
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<MessageRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Nie zapisuj drugiego identycznego powitania asystenta pod rząd
  if (role === 'assistant') {
    const { data: last } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      last?.role === 'assistant' &&
      last.content.trim() === content.trim()
    ) {
      return null;
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();

  if (error) {
    console.error('saveMessage', error.message);
    return null;
  }

  await touchConversation(conversationId);
  return data;
}

export async function getLatestConversation(): Promise<ConversationRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getLatestConversation', error.message);
    return null;
  }
  return data;
}

export async function getMessagesForConversation(conversationId: string): Promise<MessageRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getMessagesForConversation', error.message);
    return [];
  }
  return data ?? [];
}

export async function getConversationById(conversationId: string): Promise<ConversationRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('getConversationById', error.message);
    return null;
  }
  return data;
}

export type ConversationListItem = ConversationRow & {
  message_count: number;
  last_message_preview: string | null;
};

/** Lista rozmów z liczbą wiadomości i podglądem ostatniej (W4). */
export async function listConversationsWithMeta(): Promise<ConversationListItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('listConversationsWithMeta', error.message);
    return [];
  }
  if (!conversations?.length) return [];

  const items: ConversationListItem[] = await Promise.all(
    conversations.map(async (conversation) => {
      const { data: lastMessages, count, error: msgError } = await supabase
        .from('messages')
        .select('content', { count: 'exact' })
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (msgError) {
        console.error('listConversationsWithMeta messages', msgError.message);
      }

      const preview = lastMessages?.[0]?.content?.replace(/\s+/g, ' ').trim() ?? null;

      return {
        ...conversation,
        message_count: count ?? 0,
        last_message_preview: preview
          ? preview.length > 100
            ? `${preview.slice(0, 99)}…`
            : preview
          : null,
      };
    }),
  );

  return items;
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  // messages kasują się przez ON DELETE CASCADE
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
  if (error) {
    console.error('deleteConversation', error.message);
    return false;
  }
  return true;
}

/** Względna data po polsku (W4). */
export function formatConversationWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return 'przed chwilą';
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffH < 24) return `${diffH} godz. temu`;

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startMsg.getTime() === startYesterday.getTime()) return 'wczoraj';

  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

/** Ostatnia rozmowa + jej wiadomości (do hydracji czatu). */
export async function loadLatestChatHistory(): Promise<{
  conversation: ConversationRow | null;
  messages: MessageRow[];
}> {
  const conversation = await getLatestConversation();
  if (!conversation) return { conversation: null, messages: [] };
  const messages = dedupeConsecutiveAssistantRows(
    await getMessagesForConversation(conversation.id),
  );
  return { conversation, messages };
}

/** Konkretna rozmowa po id (Kontynuuj z /history). */
export async function loadChatHistoryById(conversationId: string): Promise<{
  conversation: ConversationRow | null;
  messages: MessageRow[];
}> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return { conversation: null, messages: [] };
  const messages = dedupeConsecutiveAssistantRows(
    await getMessagesForConversation(conversation.id),
  );
  return { conversation, messages };
}
