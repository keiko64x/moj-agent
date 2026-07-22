import ChatExperience from '../components/ChatExperience';
import { isSupabaseConfigured } from '@/app/lib/supabase';

type ChatPageProps = {
  searchParams: Promise<{ c?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { c } = await searchParams;
  const conversationId = c?.trim() || null;

  return (
    <ChatExperience
      key={conversationId ?? 'latest'}
      title="🍕 Agentosław — Pizzeria"
      subtitle="Znam cennik, FAQ i regulamin z bazy wiedzy. Zapytaj o pizzę, ceny lub dostawę."
      api="/api/chat"
      placeholder="Np. Ile kosztuje Pepperoni? Jaka jest minimalna dostawa?"
      showModelSwitcher
      showContextPanel
      showBranding
      showToolTimeline
      renderMarkdown
      persistHistory={isSupabaseConfigured()}
      initialConversationId={conversationId}
      commandModes={[
        { id: 'short', label: 'Hot take' },
        { id: 'detail', label: 'Deep dive' },
        { id: 'optimist', label: 'Hype' },
        { id: 'pesimist', label: 'Skeptyk' },
      ]}
      samplePrompts={[
        'Ile kosztuje pizza Pepperoni?',
        'Jaka jest minimalna kwota zamówienia z dostawą?',
        'W jakich godzinach jesteście otwarci?',
        'Co zawiera Margherita i ile kosztuje?',
      ]}
    />
  );
}
