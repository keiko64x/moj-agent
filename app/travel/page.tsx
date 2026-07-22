import ChatExperience from '../components/ChatExperience';
import { REACT_TOOL_COUNT } from '../lib/agent-tools';

const TOOLS_PANEL = [
  { emoji: '🌱', label: 'Zielone Gastro', active: true },
  { emoji: '👕', label: 'Krótki rękawek', active: true },
  { emoji: '🌳', label: 'Prastare olbrzymy', active: true },
  { emoji: '🌤️', label: 'Pogoda', active: true },
  { emoji: '💱', label: 'Kursy NBP', active: true },
  { emoji: '📅', label: 'Święta', active: true },
  { emoji: '🌐', label: 'Google Search', active: true },
  { emoji: '📚', label: 'Wikipedia', active: true },
];

const SCENARIOS = [
  'Planuję weekend w Berlinie. Budżet: 2000 PLN. Interesują mnie wege restauracje i stare drzewa.',
  'Lecę do Barcelony na 5 dni — kiedy mogę chodzić w krótkim rękawku?',
  'Wycieczka do Pragi z rodziną na 3 dni — poszuka wegańskich lokali',
  'Podróż służbowa do Londynu — gastro wege + prastare drzewa w okolicy',
  'Porównaj Barcelonę i Lizbonę: pogoda na krótki rękawek, wege i zabytkowe drzewa',
];

export default function TravelPage() {
  return (
    <ChatExperience
      title="✈️ Asystent podróży AI"
      subtitle={`${REACT_TOOL_COUNT} narzędzi • Gastro wege • Krótki rękawek • Prastare drzewa`}
      api="/api/travel"
      placeholder="Np. Lecę do Barcelony na weekend..."
      showToolTimeline
      showSources
      renderMarkdown
      markdownVariant="travel"
      showDiagnostics
      diagnosticsMaxSteps={8}
      toolsPanel={TOOLS_PANEL}
      samplePrompts={SCENARIOS}
    />
  );
}
