import ChatExperience from '../components/ChatExperience';

export default function FewshotPage() {
  return (
    <ChatExperience
      title="📚 Słownik AI"
      subtitle="Wyjaśniam trudne pojęcia prostym językiem"
      api="/api/fewshot"
      placeholder="Wpisz pojęcie do wyjaśnienia..."
      samplePrompts={[
        'Sztuczna inteligencja',
        'Agent AI',
        'Prompt',
        'Halucynacja AI',
        'RAG',
        'API',
      ]}
    />
  );
}
