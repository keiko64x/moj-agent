import ChatExperience from '../components/ChatExperience';

export default function SearchPage() {
  return (
    <ChatExperience
      title="🌐 Agent z wyszukiwarką"
      subtitle="Przeszukuję prawdziwy internet i czytam strony — aktualne newsy o AI"
      api="/api/chat"
      placeholder="Zapytaj o cokolwiek aktualnego w świecie tech..."
      agentMode="search"
      showSources
      renderMarkdown
      samplePrompts={[
        'Jakie są najnowsze wiadomości o sztucznej inteligencji?',
        'Ile kosztuje subskrypcja ChatGPT Pro?',
        'Kto wygrał ostatnią konferencję AI w San Francisco?',
        'Jakie startupy AI zebrały najwięcej fundingu w 2026?',
      ]}
    />
  );
}
