import ChatExperience from '../components/ChatExperience';

export default function ThinkPage() {
  return (
    <ChatExperience
      title="🧠 Tryb głębokiego myślenia"
      subtitle="Agent pokazuje tok rozumowania krok po kroku"
      api="/api/think"
      placeholder="Zadaj trudne pytanie..."
      renderMarkdown
    />
  );
}
