import ChatExperience from '../components/ChatExperience';

export default function ExtractPage() {
  return (
    <ChatExperience
      title="📊 Analizator"
      subtitle="Wyciągam tekst, dane i strukturę ze screenshotów i obrazów"
      api="/api/chat"
      placeholder="Wklej screenshot i poproś o ekstrakcję danych..."
      agentMode="vision"
      visionLayout
      renderMarkdown
      samplePrompts={[
        'Wyciągnij cały tekst z tego screena',
        'Zrób listę wszystkich cen widocznych na obrazie',
        'Wypisz dane kontaktowe z tego zdjęcia',
        'Przekształć tabelę ze screena na format markdown',
      ]}
    />
  );
}
