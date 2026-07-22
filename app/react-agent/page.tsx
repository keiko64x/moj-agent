import ChatExperience from '../components/ChatExperience';
import { REACT_TOOL_COUNT } from '../lib/agent-tools';

const TOOLS_PANEL = [
  { emoji: '🧮', label: 'Kalkulator', active: true },
  { emoji: '🕐', label: 'Data i czas', active: true },
  { emoji: '🌤️', label: 'Pogoda', active: true },
  { emoji: '💱', label: 'Kursy NBP', active: true },
  { emoji: '📅', label: 'Święta', active: true },
  { emoji: '📚', label: 'Wikipedia', active: true },
  { emoji: '📝', label: 'Notatki', active: true },
  { emoji: '🌐', label: 'Google Search', active: true },
  { emoji: '📄', label: 'Czytanie stron', active: true },
];

const SCENARIOS = [
  'Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca w Wikipedii, i powiedz czy są jakieś święta w ten weekend',
  'Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach, i zapisz wszystkie kursy w notatkach',
  'Porównaj pogodę w Warszawie, Berlinie i Paryżu. Który z tych miast ma dziś najlepszą pogodę?',
  'Jaka pogoda w Qwerty?',
  'Ile kosztuje XYZ?',
];

export default function ReactAgentPage() {
  return (
    <ChatExperience
      title="🔄 Agent ReAct — Autonomiczne rozumowanie"
      subtitle={`${REACT_TOOL_COUNT} narzędzi • Opisz cel → agent sam planuje i realizuje`}
      api="/api/react"
      placeholder="Opisz co chcesz osiągnąć..."
      showToolTimeline
      showSources
      toolsPanel={TOOLS_PANEL}
      renderMarkdown
      markdownVariant="react"
      showDiagnostics
      samplePrompts={SCENARIOS}
    />
  );
}
