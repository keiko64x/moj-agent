import ChatExperience from '../components/ChatExperience';

export default function VisionPage() {
  return (
    <ChatExperience
      title="👁️ Agent Vision"
      subtitle="Wklej screenshot, wrzuć plik lub przeciągnij obraz"
      api="/api/chat"
      placeholder="Zadaj pytanie o obraz..."
      agentMode="vision"
      visionLayout
      showPostImages
      enableGenerateSimilar
      renderMarkdown
      samplePrompts={[
        'Co widzisz na tym obrazie?',
        'Wyciągnij cały tekst z tego screena',
        'Opisz to w 3 zdaniach',
        'Jakie kolory dominują? Podaj kody HEX',
        'Wygeneruj podobny obraz w innym stylu',
      ]}
    />
  );
}
