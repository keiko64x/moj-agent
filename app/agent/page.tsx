import ChatExperience from '../components/ChatExperience';
import { AGENT_TOOL_COUNT } from '../lib/agent-tools';

const TOOLS_PANEL = [
  { emoji: '🧮', label: 'Kalkulator', active: true },
  { emoji: '🕐', label: 'Data i czas', active: true },
  { emoji: '🌤️', label: 'Pogoda', active: true },
  { emoji: '👕', label: 'Krótki rękawek', active: true },
  { emoji: '💱', label: 'Kursy NBP', active: true },
  { emoji: '📅', label: 'Święta', active: true },
  { emoji: '📚', label: 'Wikipedia', active: true },
  { emoji: '📝', label: 'Notatki', active: true },
  { emoji: '🌐', label: 'Google Search', active: true },
  { emoji: '📄', label: 'Czytanie stron', active: true },
  { emoji: '🎨', label: 'Generowanie obrazów', active: true },
  { emoji: '👁️', label: 'Analiza obrazów', active: true },
];

const SCENARIOS = [
  'Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo',
  'Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone',
  'Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto',
  'Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym',
  "Wyszukaj w Google 'best coffee shops Kraków' i streszcz wyniki",
];

export default function AgentPage() {
  return (
    <ChatExperience
      title="🤖 Agentosław Reaktowski — Pełna moc"
      subtitle={`${AGENT_TOOL_COUNT} narzędzi • autonomiczne decyzje`}
      api="/api/chat"
      placeholder="Zadaj złożone zadanie — agent sam wybierze narzędzia..."
      agentMode="agent"
      showToolTimeline
      showPostImages
      toolsPanel={TOOLS_PANEL}
      renderMarkdown
      samplePrompts={SCENARIOS}
    />
  );
}
