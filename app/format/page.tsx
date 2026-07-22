import ChatExperience from '../components/ChatExperience';

export default function FormatPage() {
  return (
    <ChatExperience
      title="📐 Formatowanie"
      subtitle="Agent odpowiada w tabeli, liście, porównaniu — na żądanie"
      api="/api/format"
      placeholder="Wpisz komendę formatu lub zwykłe pytanie..."
      renderMarkdown
      sampleCommands={[
        '/tabela języki programowania 2026',
        '/porownanie ChatGPT vs Claude',
        '/lista 5 kroków do pierwszego agenta AI',
        '/faq sztuczna inteligencja dla początkujących',
        '/email podziękowanie za udaną rekrutację',
      ]}
    />
  );
}
