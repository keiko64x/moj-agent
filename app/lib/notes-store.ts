export type AgentNote = {
  title: string;
  content: string;
  createdAt: string;
};

const notes = new Map<string, AgentNote>();

export function saveAgentNote(title: string, content: string): AgentNote {
  const note: AgentNote = {
    title,
    content,
    createdAt: new Date().toISOString(),
  };
  notes.set(title, note);
  return note;
}

export function getAgentNotes(): AgentNote[] {
  return Array.from(notes.values());
}
