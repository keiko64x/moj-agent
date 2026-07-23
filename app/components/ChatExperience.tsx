'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import MarkdownMessage from './MarkdownMessage';
import ReactMarkdownMessage from './ReactMarkdownMessage';
import TravelMarkdownMessage from './TravelMarkdownMessage';
import DiagnosticsPanel from './DiagnosticsPanel';
import TechLogo from './TechLogo';
import { GeneratedImageBlock, ToolTimeline, AttachedPostImageBlock } from './ToolTimeline';
import ThinkingIndicator from './ThinkingIndicator';
import {
  estimateTokens,
  formatConversationForExport,
  getAssistantModel,
  getAssistantResponseMode,
  getMessageText,
  MODEL_BADGES,
  MODEL_OPTIONS,
  RESPONSE_MODE_BADGES,
  type ChatModel,
  type ResponseMode,
} from '../lib/chat-utils';
import { splitKnowledgeCitation } from '@/app/lib/citation-utils';
import {
  clipboardItemToAttachedImage,
  fileToAttachedImage,
  getImageParts,
  getPrecedingUserImageUrls,
  userRequestedUploadedImageInPost,
  type AttachedImage,
} from '../lib/image-utils';
import { countToolParts, getGenerateImageFromParts, getToolParts } from '../lib/tool-utils';
import {
  createConversation,
  dbMessagesToUIMessages,
  dedupeConsecutiveAssistantUIMessages,
  loadChatHistoryById,
  makeConversationTitle,
  saveMessage,
  touchConversation,
} from '@/app/lib/conversations';
import {
  assistantAskedAboutFood,
  ensureBrowserUserProfile,
  extractNameFromMessage,
  extractPreferencesFromMessage,
  formatPreferencesShort,
  getUserProfile,
  syncBrowserUserId,
  updateUserName,
  updateUserPreferencesBatch,
} from '@/app/lib/user-profile';
import { useAuth } from '@/app/lib/auth';
import type { UserProfileRow } from '@/app/lib/supabase-types';

type ChatExperienceProps = {
  title: string;
  subtitle: string;
  api: string;
  placeholder: string;
  agentMode?: 'search' | 'vision' | 'agent';
  showModelSwitcher?: boolean;
  showContextPanel?: boolean;
  showSources?: boolean;
  showToolTimeline?: boolean;
  showPostImages?: boolean;
  visionLayout?: boolean;
  enableGenerateSimilar?: boolean;
  toolsPanel?: { emoji: string; label: string; active: boolean }[];
  samplePrompts?: string[];
  sampleCommands?: string[];
  commandModes?: { id: ResponseMode; label: string }[];
  renderMarkdown?: boolean;
  markdownVariant?: 'default' | 'react' | 'travel';
  showDiagnostics?: boolean;
  diagnosticsMaxSteps?: number;
  showBranding?: boolean;
  /** Zapis/odczyt rozmowy i profilu w Supabase — tylko /chat. */
  persistHistory?: boolean;
  /** Kontynuuj konkretną rozmowę z /history (W4). */
  initialConversationId?: string | null;
};

export default function ChatExperience({
  title,
  subtitle,
  api,
  placeholder,
  agentMode,
  showModelSwitcher = false,
  showContextPanel = false,
  showSources = false,
  showToolTimeline = false,
  showPostImages = false,
  visionLayout = false,
  enableGenerateSimilar = false,
  toolsPanel = [],
  samplePrompts = [],
  sampleCommands = [],
  commandModes = [],
  renderMarkdown = false,
  markdownVariant = 'default',
  showDiagnostics = false,
  diagnosticsMaxSteps = 5,
  showBranding = false,
  persistHistory = false,
  initialConversationId = null,
}: ChatExperienceProps) {
  const { user: authUser, getAccessToken } = useAuth();
  const accessTokenRef = useRef<string | null>(null);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [generatedSimilarImage, setGeneratedSimilarImage] = useState<string | null>(null);
  const [generatingSimilar, setGeneratingSimilar] = useState(false);
  const [pendingGenerateSimilar, setPendingGenerateSimilar] = useState(false);
  const [comparisonOriginal, setComparisonOriginal] = useState<AttachedImage | null>(null);
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [lastResponseMs, setLastResponseMs] = useState<number | null>(null);
  const [model, setModel] = useState<ChatModel>('flash');
  const [responseMode, setResponseMode] = useState<ResponseMode | null>(null);
  const [contextExpanded, setContextExpanded] = useState(true);
  const [exportNotice, setExportNotice] = useState('');
  const [liveElapsedMs, setLiveElapsedMs] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(persistHistory);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(authUser?.id ?? null);
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const savedMessageIdsRef = useRef<Set<string>>(new Set());
  const titleLockedRef = useRef(false);
  const persistLockRef = useRef(false);
  const welcomeInjectedRef = useRef(false);
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (authUser?.id) {
      syncBrowserUserId(authUser.id);
      setUserId(authUser.id);
      void getAccessToken().then((token) => {
        accessTokenRef.current = token;
      });
    } else {
      setUserId(null);
      accessTokenRef.current = null;
    }
  }, [authUser?.id, getAccessToken]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api,
        headers: async (): Promise<Record<string, string>> => {
          const token = await getAccessToken();
          accessTokenRef.current = token;
          if (!token) return {};
          return { Authorization: `Bearer ${token}` };
        },
        body: () => ({
          ...(showModelSwitcher ? { model } : {}),
          ...(responseMode ? { responseMode } : {}),
          ...(agentMode ? { agentMode } : {}),
          ...(userIdRef.current ? { userId: userIdRef.current } : {}),
        }),
      }),
    [api, model, responseMode, agentMode, showModelSwitcher, getAccessToken],
  );

  const [chatError, setChatError] = useState('');

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (error) => {
      console.error('useChat', error);
      setChatError(error.message || 'Błąd odpowiedzi agenta');
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const visibleMessages = useMemo(
    () => dedupeConsecutiveAssistantUIMessages(messages),
    [messages],
  );
  const lastMessage = visibleMessages.at(-1);
  const lastAssistantText =
    lastMessage?.role === 'assistant' ? getMessageText(lastMessage.parts).trim() : '';
  const lastAssistantTools =
    lastMessage?.role === 'assistant' ? countToolParts(lastMessage.parts) : 0;
  const hasAssistantActivity =
    lastMessage?.role === 'assistant' &&
    (lastAssistantText.length > 0 || getToolParts(lastMessage.parts).length > 0);
  const isThinking = isLoading && !hasAssistantActivity;
  const messageCount = visibleMessages.length;
  const tokenEstimate = estimateTokens(visibleMessages);
  const quickActions = sampleCommands.length > 0 ? sampleCommands : samplePrompts;
  const lastAssistantMessage = [...visibleMessages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const diagnosticsElapsedMs =
    isLoading && requestStartedAt
      ? liveElapsedMs
      : lastResponseMs;

  useEffect(() => {
    if (!persistHistory) {
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setHistoryLoading(true);
      try {
        const authId = authUser?.id ?? null;
        if (!authId) {
          setUserId(null);
          setUserProfile(null);
          return;
        }

        syncBrowserUserId(authId);
        setUserId(authId);

        const profile = await ensureBrowserUserProfile(authId);
        if (cancelled) return;
        if (profile) setUserProfile(profile);

        // Kontynuacja z /history?c=...
        if (initialConversationId) {
          const { conversation, messages: rows } =
            await loadChatHistoryById(initialConversationId);
          if (cancelled) return;

          if (conversation) {
            conversationIdRef.current = conversation.id;
            setConversationTitle(conversation.title);
            titleLockedRef.current =
              Boolean(conversation.title) && conversation.title !== 'Nowa rozmowa';
            const uiMessages = dedupeConsecutiveAssistantUIMessages(
              dbMessagesToUIMessages(rows),
            );
            for (const msg of uiMessages) savedMessageIdsRef.current.add(msg.id);
            setMessages(uiMessages);
            welcomeInjectedRef.current = true;
            return;
          }
        }

        // Odświeżenie / wejście na /chat → ZAWSZE świeże okno (bez starych promptów)
        conversationIdRef.current = null;
        savedMessageIdsRef.current = new Set();
        titleLockedRef.current = false;
        setConversationTitle(null);
        welcomeInjectedRef.current = true;

        const name = profile?.name?.trim();
        const welcomeText = name
          ? `Cześć, ${name}! Miło Cię znowu widzieć! Czym mogę Ci pomóc?`
          : 'Cześć! Nie znamy się jeszcze. Jestem Agentosław Reaktowski — jak masz na imię?';

        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            parts: [{ type: 'text', text: welcomeText }],
          },
        ]);
      } catch (error) {
        console.error('bootChatSession', error);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistHistory, setMessages, initialConversationId, authUser?.id]);

  useEffect(() => {
    if (!persistHistory || historyLoading || persistLockRef.current) return;

    // Nie twórz rozmowy w bazie samym powitaniem — dopiero gdy user coś napisze
    const hasUserMessage = messages.some((m) => m.role === 'user');
    if (!hasUserMessage) return;

    const unsaved = messages.filter((message) => {
      if (savedMessageIdsRef.current.has(message.id)) return false;
      if (message.role !== 'user' && message.role !== 'assistant') return false;
      const text = getMessageText(message.parts).trim();
      if (!text) return false;
      if (message.role === 'assistant' && isLoading && message.id === messages.at(-1)?.id) {
        return false;
      }
      return true;
    });

    if (unsaved.length === 0) return;

    let cancelled = false;
    persistLockRef.current = true;

    (async () => {
      try {
        for (const message of unsaved) {
          if (cancelled) return;
          const text = getMessageText(message.parts).trim();
          if (!text) continue;

          let conversationId = conversationIdRef.current;
          if (!conversationId) {
            const title =
              message.role === 'user' ? makeConversationTitle(text) : 'Nowa rozmowa';
            const created = await createConversation(title);
            if (!created) continue;
            conversationId = created.id;
            conversationIdRef.current = conversationId;
            setConversationTitle(created.title);
            titleLockedRef.current = message.role === 'user';
          } else if (message.role === 'user' && !titleLockedRef.current) {
            const title = makeConversationTitle(text);
            await touchConversation(conversationId, title);
            setConversationTitle(title);
            titleLockedRef.current = true;
          }

          const saved = await saveMessage(
            conversationId,
            message.role as 'user' | 'assistant',
            text,
          );
          if (saved) {
            savedMessageIdsRef.current.add(message.id);
            savedMessageIdsRef.current.add(saved.id);
          }
        }
      } catch (error) {
        console.error('persistChatHistory', error);
      } finally {
        persistLockRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, isLoading, historyLoading, persistHistory]);

  // Odśwież profil po odpowiedzi agenta (np. po saveUserName) — tylko /chat
  useEffect(() => {
    if (!persistHistory || !userId || status !== 'ready' || historyLoading) return;
    void getUserProfile(userId).then((profile) => {
      if (profile) setUserProfile(profile);
    });
  }, [persistHistory, status, userId, historyLoading, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading || !requestStartedAt) {
      setLiveElapsedMs(null);
      return;
    }

    const updateElapsed = () => setLiveElapsedMs(Date.now() - requestStartedAt);
    updateElapsed();
    const interval = setInterval(updateElapsed, 200);
    return () => clearInterval(interval);
  }, [isLoading, requestStartedAt]);

  useEffect(() => {
    if (requestStartedAt && status === 'ready' && messages.length > 0) {
      setLastResponseMs(Date.now() - requestStartedAt);
      setRequestStartedAt(null);
    }
  }, [status, messages.length, requestStartedAt]);

  useEffect(() => {
    return () => {
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingGenerateSimilar || isLoading) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return;

    const text = getMessageText(lastAssistant.parts);
    const promptMatch = text.match(/PROMPT:\s*(.+)/is);
    if (!promptMatch) return;

    const imagePrompt = promptMatch[1].trim();
    setPendingGenerateSimilar(false);
    setGeneratingSimilar(true);

    fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: imagePrompt }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.image) setGeneratedSimilarImage(data.image);
      })
      .catch(() => setImageError('Nie udało się wygenerować podobnego obrazu.'))
      .finally(() => setGeneratingSimilar(false));
  }, [messages, pendingGenerateSimilar, isLoading]);

  const handleNewConversation = useCallback(async () => {
    setMessages([]);
    setExportNotice('');
    setConversationTitle(null);
    savedMessageIdsRef.current = new Set();
    titleLockedRef.current = false;
    welcomeInjectedRef.current = false;

    if (!persistHistory) {
      conversationIdRef.current = null;
      return;
    }

    const created = await createConversation('Nowa rozmowa');
    conversationIdRef.current = created?.id ?? null;
    setConversationTitle(created?.title ?? 'Nowa rozmowa');

    const name = userProfile?.name?.trim();
    const welcomeText = name
      ? `Cześć, ${name}! Miło Cię znowu widzieć! Czym mogę Ci pomóc?`
      : 'Cześć! Nie znamy się jeszcze. Jestem Agentosław Reaktowski — jak masz na imię?';
    const welcomeId = crypto.randomUUID();
    welcomeInjectedRef.current = true;
    setMessages([
      {
        id: welcomeId,
        role: 'assistant',
        parts: [{ type: 'text', text: welcomeText }],
      },
    ]);

    if (created?.id) {
      void saveMessage(created.id, 'assistant', welcomeText).then((saved) => {
        if (saved) {
          savedMessageIdsRef.current.add(welcomeId);
          savedMessageIdsRef.current.add(saved.id);
        }
      });
    }
  }, [persistHistory, setMessages, userProfile?.name]);
  async function attachImageFile(file: File) {
    try {
      setImageError('');
      const image = await fileToAttachedImage(file);
      setAttachedImage(image);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Nie udało się wczytać obrazu.');
    }
  }

  async function handlePaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue;
      event.preventDefault();
      try {
        setImageError('');
        const image = await clipboardItemToAttachedImage(item);
        if (image) setAttachedImage(image);
      } catch (error) {
        setImageError(error instanceof Error ? error.message : 'Nie udało się wkleić obrazu.');
      }
      return;
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) await attachImageFile(file);
  }

  async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await attachImageFile(file);
    event.target.value = '';
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim() || (attachedImage ? 'Co widzisz na tym obrazie?' : '');
    if ((!text && !attachedImage) || isLoading) return;

    const wantsSimilar =
      enableGenerateSimilar &&
      /podobn/i.test(text) &&
      attachedImage !== null;

    // Nie czekaj na tool modelu — zapisz imię i preferencje od razu (tylko /chat)
    const currentUserId = persistHistory ? userIdRef.current : null;
    if (currentUserId && text) {
      if (!userProfile?.name?.trim()) {
        const extracted = extractNameFromMessage(text);
        if (extracted) {
          void updateUserName(currentUserId, extracted).then((profile) => {
            if (profile?.name) {
              setUserProfile(profile);
              setConversationTitle(`Czat z ${profile.name}`);
              titleLockedRef.current = true;
              if (conversationIdRef.current) {
                void touchConversation(conversationIdRef.current, `Czat z ${profile.name}`);
              }
            }
          });
        }
      }

      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      const askedFood = lastAssistant
        ? assistantAskedAboutFood(getMessageText(lastAssistant.parts))
        : false;
      const prefs = extractPreferencesFromMessage(text, {
        treatShortReplyAsFood: askedFood,
      });
      if (Object.keys(prefs).length > 0) {
        void updateUserPreferencesBatch(currentUserId, prefs).then((profile) => {
          if (profile) setUserProfile(profile);
        });
      }
    }

    setChatError('');
    sendMessage({
      text,
      files: attachedImage ? [attachedImage] : undefined,
      metadata: {
        ...(showModelSwitcher ? { model } : {}),
        ...(responseMode ? { responseMode } : {}),
        ...(attachedImage ? { attachedImageUrl: attachedImage.url } : {}),
      },
    });

    if (wantsSimilar) {
      setPendingGenerateSimilar(true);
      setGeneratedSimilarImage(null);
      setComparisonOriginal(attachedImage);
    }

    setRequestStartedAt(Date.now());
    setInput('');
    setAttachedImage(null);
  }

  async function handleExportConversation() {
    if (messages.length === 0) return;

    try {
      await navigator.clipboard.writeText(formatConversationForExport(messages));
      setExportNotice('Skopiowano!');

      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }

      exportTimeoutRef.current = setTimeout(() => {
        setExportNotice('');
      }, 2000);
    } catch {
      setExportNotice('Nie udało się skopiować');
    }
  }

  function handleQuickAction(value: string) {
    setInput(value);
  }

  function handleSelectResponseMode(modeId: ResponseMode) {
    setResponseMode((current) => (current === modeId ? null : modeId));
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <div style={styles.headerText}>
              {showBranding ? (
                <TechLogo
                  title="Agentosław Reaktowski"
                  subtitle="Twój sztuczny inteligent za jeden uśmiech. Daj mi misje!"
                />
              ) : (
                <>
                  <h1 style={styles.title}>{title}</h1>
                  <p style={styles.subtitle}>{subtitle}</p>
                </>
              )}
              {persistHistory && conversationTitle && (
                <p style={styles.conversationTitle}>💬 Rozmowa: {conversationTitle}</p>
              )}
              {persistHistory && (
                <>
                  <p style={styles.userGreetingBadge}>
                    {userProfile?.name?.trim()
                      ? `👤 Profil: ${userProfile.name.trim()}`
                      : '👤 Profil: (jeszcze bez imienia)'}
                  </p>
                  {formatPreferencesShort(userProfile?.preferences) && (
                    <p style={styles.userPrefsBadge}>
                      {formatPreferencesShort(userProfile?.preferences)}
                    </p>
                  )}
                </>
              )}
            </div>
            {persistHistory && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href="/history" style={styles.historyLink}>
                  📜 Historia
                </a>
                <button
                  type="button"
                  onClick={() => void handleNewConversation()}
                  style={styles.newChatButton}
                  disabled={historyLoading}
                >
                  + Nowa rozmowa
                </button>
              </div>
            )}
          </div>
        </header>

        {showBranding && (
          <p style={styles.brandIntro}>{subtitle}</p>
        )}

        {toolsPanel.length > 0 && (
          <div style={styles.toolsPanel}>
            <span style={styles.toolsPanelLabel}>Moje narzędzia</span>
            <div style={styles.toolsGrid}>
              {toolsPanel.map((tool) => (
                <div key={tool.label} style={styles.toolItem}>
                  <span>{tool.emoji} {tool.label}</span>
                  <span style={styles.toolActive}>{tool.active ? '✅ aktywny' : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {commandModes.length > 0 && (
          <div style={styles.commandModes}>
            <span style={styles.commandLabel}>Tryb odpowiedzi:</span>
            <div style={styles.commandButtons}>
              {commandModes.map((mode) => {
                const isActive = responseMode === mode.id;

                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSelectResponseMode(mode.id)}
                    style={{
                      ...styles.commandButton,
                      ...(isActive ? styles.commandButtonActive : {}),
                    }}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            {responseMode && (
              <p style={styles.commandHint}>
                Aktywny tryb: <strong>{RESPONSE_MODE_BADGES[responseMode].label}</strong>
                {' — '}
                odpowiedź będzie w tym formacie few-shot
              </p>
            )}
          </div>
        )}

        {quickActions.length > 0 && (
        <div style={styles.quickActions}>
          {quickActions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleQuickAction(item)}
              style={styles.quickButton}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {showContextPanel && (
        <section style={styles.contextPanel}>
          <button
            type="button"
            onClick={() => setContextExpanded((expanded) => !expanded)}
            style={styles.contextToggle}
          >
            <span>Kontekst rozmowy</span>
            <span>{contextExpanded ? '▾' : '▸'}</span>
          </button>

          {contextExpanded && (
            <div style={styles.contextBody}>
              <p style={styles.contextStats}>
                Wiadomości: {messageCount} | ~Tokeny: {tokenEstimate}
              </p>
              <div style={styles.contextActions}>
                <button
                  type="button"
                  onClick={() => void handleNewConversation()}
                  style={styles.contextButton}
                  disabled={historyLoading}
                >
                  + Nowa rozmowa
                </button>
                <button
                  type="button"
                  onClick={handleExportConversation}
                  style={styles.contextButton}
                  disabled={messageCount === 0}
                >
                  📋 Eksportuj rozmowę
                </button>
                {exportNotice && (
                  <span style={styles.exportNotice}>{exportNotice}</span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <div
        style={{
          ...styles.messages,
          ...(isDragging ? styles.messagesDragging : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {historyLoading && (
          <div style={styles.historyLoading}>
            <span style={styles.historySpinner} aria-hidden>
              ⏳
            </span>
            Ładowanie rozmowy z Supabase…
          </div>
        )}

        {!historyLoading && visionLayout && visibleMessages.length === 0 && !attachedImage && (
          <div style={styles.visionDropZone}>
            <p style={styles.visionDropTitle}>📸 Ctrl+V — wklej screenshot</p>
            <p style={styles.visionDropHint}>📁 Kliknij 📎 — wybierz plik</p>
            <p style={styles.visionDropHint}>🖱️ Przeciągnij — upuść obraz</p>
          </div>
        )}

        {isDragging && (
          <div style={styles.dropOverlay}>Upuść obraz</div>
        )}

        {!historyLoading && visibleMessages.map((message, index) => {
          const isUser = message.role === 'user';
          const text = getMessageText(message.parts);
          const citation = !isUser ? splitKnowledgeCitation(text) : null;
          const displayText = citation?.citationLabel ? citation.body : text;
          const imageParts = getImageParts(message.parts);
          const sources = showSources
            ? message.parts.filter((part) => part.type === 'source-url')
            : [];
          const messageModel = getAssistantModel(visibleMessages, index);
          const messageResponseMode = getAssistantResponseMode(visibleMessages, index);
          const modelBadge = MODEL_BADGES[messageModel];
          const modelBadgeStyle =
            messageModel === 'pro' ? styles.modelBadgePro : styles.modelBadgeFlash;
          const responseBadge = messageResponseMode
            ? RESPONSE_MODE_BADGES[messageResponseMode]
            : null;
          const toolCount = countToolParts(message.parts);
          const showTimeline = showToolTimeline && !isUser && toolCount > 0;
          const generatedImage = !isUser ? getGenerateImageFromParts(message.parts) : null;
          const precedingUserImages =
            !isUser && showPostImages
              ? getPrecedingUserImageUrls(visibleMessages, index)
              : [];
          const precedingUserText = !isUser
            ? getMessageText(
                visibleMessages
                  .slice(0, index)
                  .reverse()
                  .find((m) => m.role === 'user')?.parts ?? [],
              )
            : '';
          const showAttachedPostImage =
            !isUser &&
            showPostImages &&
            precedingUserImages.length > 0 &&
            !generatedImage &&
            (userRequestedUploadedImageInPost(precedingUserText) ||
              /post|linkedin|facebook|fb|social|instagram/i.test(precedingUserText) ||
              agentMode === 'agent' ||
              agentMode === 'vision');
          const lastAssistantIndex = visibleMessages.map((m) => m.role).lastIndexOf('assistant');
          const showStats =
            showToolTimeline &&
            !isUser &&
            toolCount > 0 &&
            index === lastAssistantIndex &&
            !isLoading;

          return (
            <div
              key={message.id}
              style={{
                ...styles.messageRow,
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  ...styles.messageBubble,
                  ...(isUser ? styles.userBubble : styles.assistantBubble),
                }}
              >
                {!isUser && (showModelSwitcher || responseBadge) && (
                  <div style={styles.badgeRow}>
                    {showModelSwitcher && (
                      <span style={{ ...styles.badge, ...modelBadgeStyle }}>
                        {modelBadge.emoji} {modelBadge.label}
                      </span>
                    )}
                    {responseBadge && (
                      <span style={{ ...styles.badge, ...styles.responseBadge }}>
                        {responseBadge.emoji} {responseBadge.label}
                      </span>
                    )}
                  </div>
                )}
                {showTimeline && <ToolTimeline parts={message.parts} />}
                {imageParts.map((part, partIndex) => (
                  <img
                    key={`${message.id}-img-${partIndex}`}
                    src={part.url}
                    alt={part.filename || 'Załączony obraz'}
                    style={styles.messageImage}
                  />
                ))}
                {displayText && (
                  !isUser && renderMarkdown ? (
                    markdownVariant === 'react' ? (
                      <ReactMarkdownMessage content={displayText} />
                    ) : markdownVariant === 'travel' ? (
                      <TravelMarkdownMessage content={displayText} />
                    ) : (
                      <MarkdownMessage content={displayText} />
                    )
                  ) : (
                    displayText
                  )
                )}
                {!isUser && citation?.citationLabel && (
                  <div style={styles.knowledgeCitation}>
                    <span style={styles.knowledgeCitationIcon} aria-hidden>
                      📎
                    </span>
                    <span style={styles.knowledgeCitationLabel}>Źródło:</span>
                    {citation.citationTitles.map((title, titleIndex) => (
                      <a
                        key={`${message.id}-cite-${titleIndex}`}
                        href={`/knowledge?doc=${encodeURIComponent(title)}`}
                        style={styles.knowledgeCitationLink}
                      >
                        {title}
                        {titleIndex < citation.citationTitles.length - 1 ? ',' : ''}
                      </a>
                    ))}
                  </div>
                )}
                {!isUser && showAttachedPostImage && (
                  <AttachedPostImageBlock image={precedingUserImages[0]} />
                )}
                {!isUser && (showToolTimeline || showPostImages) && (
                  <GeneratedImageBlock parts={message.parts} />
                )}
                {!isUser && sources.length > 0 && (
                  <div style={styles.sources}>
                    <span style={styles.sourcesLabel}>Źródła:</span>
                    <ul style={styles.sourcesList}>
                      {sources.map((source) => {
                        if (source.type !== 'source-url') return null;

                        return (
                          <li key={source.sourceId}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={styles.sourceLink}
                            >
                              {source.title || source.url}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {!isUser && showStats && (
                  <div style={styles.toolStats}>
                    Użyto {toolCount} narzędzi
                    {lastResponseMs !== null ? ` | ${(lastResponseMs / 1000).toFixed(1)}s` : ''}
                    {' | Model: gemini-3.1-flash-lite'}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={{ ...styles.messageBubble, ...styles.assistantBubble, ...styles.thinkingBubble }}>
              {showToolTimeline && <ToolTimeline parts={[]} isActive />}
              {showModelSwitcher && (
                <span
                  style={{
                    ...styles.badge,
                    ...(model === 'pro' ? styles.modelBadgePro : styles.modelBadgeFlash),
                  }}
                >
                  {MODEL_BADGES[model].emoji} {MODEL_BADGES[model].label}
                </span>
              )}
              {responseMode && (
                <span style={{ ...styles.badge, ...styles.responseBadge }}>
                  {RESPONSE_MODE_BADGES[responseMode].emoji}{' '}
                  {RESPONSE_MODE_BADGES[responseMode].label}
                </span>
              )}
              <ThinkingIndicator
                label={
                  status === 'submitted'
                    ? 'Agent myśli'
                    : showToolTimeline
                      ? 'Agent wykonuje zadanie'
                      : 'Przygotowuję odpowiedź'
                }
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {(generatedSimilarImage || generatingSimilar) && enableGenerateSimilar && (
        <div style={styles.comparisonPanel}>
          <h3 style={styles.comparisonTitle}>🎨 Porównanie: oryginał vs wygenerowany</h3>
          <div style={styles.comparisonGrid}>
            <div style={styles.comparisonItem}>
              <span style={styles.comparisonLabel}>Oryginał</span>
              {comparisonOriginal ? (
                <img src={comparisonOriginal.url} alt="Oryginał" style={styles.comparisonImage} />
              ) : (
                <p style={styles.comparisonPlaceholder}>Obraz z rozmowy</p>
              )}
            </div>
            <div style={styles.comparisonItem}>
              <span style={styles.comparisonLabel}>Wygenerowany</span>
              {generatingSimilar ? (
                <div style={styles.comparisonLoading} className="pulse-loading">
                  Generuję podobny obraz...
                </div>
              ) : generatedSimilarImage ? (
                <img src={generatedSimilarImage} alt="Wygenerowany" style={styles.comparisonImage} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {attachedImage && (
        <div style={styles.imagePreview}>
          <img src={attachedImage.url} alt="Podgląd" style={styles.previewThumb} />
          <div style={styles.previewInfo}>
            <span>📎 Screenshot — zadaj pytanie o ten obraz</span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              style={styles.removeImageButton}
              aria-label="Usuń obraz"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {imageError && <p style={styles.imageError}>{imageError}</p>}
      {chatError && <p style={styles.imageError}>⚠️ {chatError}</p>}

      {showDiagnostics && lastAssistantMessage && (
        <DiagnosticsPanel
          parts={lastAssistantMessage.parts}
          isLoading={isLoading}
          elapsedMs={diagnosticsElapsedMs}
          maxSteps={diagnosticsMaxSteps}
        />
      )}

      {showModelSwitcher && (
        <div style={styles.modeSwitcher}>
          {MODEL_OPTIONS.map((item) => {
            const isActive = model === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setModel(item.id)}
                style={{
                  ...styles.modeButton,
                  ...(isActive ? styles.modeButtonActive : {}),
                }}
              >
                {item.emoji} {item.label}
                {item.id === 'flash' ? ' (szybki)' : ' (zaawansowany)'}
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={styles.attachButton}
          disabled={isLoading}
          title="Dodaj obraz"
        >
          📎
        </button>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={styles.input}
          disabled={isLoading}
        />
        <button
          type="submit"
          style={styles.button}
          disabled={isLoading || (!input.trim() && !attachedImage)}
        >
          Wyślij wiadomość
        </button>
      </form>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    maxWidth: '860px',
    margin: '0 auto',
    minHeight: 'calc(100vh - 110px)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px 32px',
  },
  card: {
    background: '#1e1e35',
    borderRadius: '20px',
    border: '1px solid #2e2e4a',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 'calc(100vh - 160px)',
  },
  header: {
    marginBottom: '12px',
    textAlign: 'center',
    paddingBottom: '16px',
    borderBottom: '1px solid #2e2e4a',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    textAlign: 'left',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  conversationTitle: {
    margin: '8px 0 0',
    fontSize: '0.85rem',
    color: '#94a3b8',
    fontWeight: 600,
  },
  userGreetingBadge: {
    margin: '4px 0 0',
    fontSize: '0.8rem',
    color: '#a7f3d0',
    fontWeight: 600,
  },
  userPrefsBadge: {
    margin: '2px 0 0',
    fontSize: '0.78rem',
    color: '#99f6e4',
    fontWeight: 500,
  },
  newChatButton: {
    border: '1px solid rgba(167, 139, 250, 0.55)',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(6, 182, 212, 0.2))',
    color: '#ede9fe',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  historyLink: {
    border: '1px solid rgba(97, 248, 248, 0.4)',
    background: 'rgba(6, 182, 212, 0.15)',
    color: '#cffafe',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '0.82rem',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
  },
  historyLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '48px 16px',
    color: '#94a3b8',
    fontSize: '0.95rem',
  },
  historySpinner: {
    fontSize: '1.2rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#f1f5f9',
  },
  subtitle: {
    marginTop: '8px',
    fontSize: '0.95rem',
    color: '#94a3b8',
    lineHeight: 1.4,
  },
  brandIntro: {
    textAlign: 'center',
    fontSize: '0.95rem',
    color: '#c4b5fd',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid #3b3b5c',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  toolsPanel: {
    marginBottom: '16px',
    padding: '12px 14px',
    background: 'rgba(6, 182, 212, 0.08)',
    border: '1px solid #2e2e4a',
    borderRadius: '12px',
  },
  toolsPanelLabel: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#06b6d4',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '8px',
  },
  toolItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: '#16162a',
    borderRadius: '8px',
    border: '1px solid #2e2e4a',
    fontSize: '0.82rem',
    color: '#e2e8f0',
  },
  toolActive: {
    fontSize: '0.75rem',
    color: '#4ade80',
  },
  toolStats: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid #2e2e4a',
    fontSize: '0.78rem',
    color: '#64748b',
  },
  commandModes: {
    marginBottom: '16px',
    padding: '12px 14px',
    background: 'rgba(15, 15, 26, 0.5)',
    border: '1px solid #2e2e4a',
    borderRadius: '12px',
  },
  commandLabel: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  commandButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  commandButton: {
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#94a3b8',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  commandButtonActive: {
    background: 'rgba(139, 92, 246, 0.2)',
    color: '#c4b5fd',
    border: '2px solid #8b5cf6',
    boxShadow: '0 0 12px rgba(139, 92, 246, 0.25)',
  },
  commandHint: {
    marginTop: '10px',
    fontSize: '0.82rem',
    color: '#94a3b8',
  },
  quickActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  quickButton: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#06b6d4',
    fontSize: '0.82rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  contextPanel: {
    marginBottom: '16px',
    border: '1px solid #2e2e4a',
    borderRadius: '14px',
    background: 'rgba(15, 15, 26, 0.5)',
    overflow: 'hidden',
  },
  contextToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    color: '#f1f5f9',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  contextBody: {
    padding: '0 16px 16px',
    borderTop: '1px solid #2e2e4a',
  },
  contextStats: {
    marginTop: '12px',
    fontSize: '0.9rem',
    color: '#94a3b8',
  },
  contextActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
    marginTop: '12px',
  },
  contextButton: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#c4b5fd',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  exportNotice: {
    fontSize: '0.85rem',
    color: '#06b6d4',
    fontWeight: 600,
  },
  messages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    marginBottom: '16px',
    padding: '16px',
    background: 'rgba(15, 15, 26, 0.5)',
    borderRadius: '14px',
    border: '1px solid #2e2e4a',
    minHeight: '280px',
    position: 'relative',
  },
  messagesDragging: {
    border: '2px dashed #8b5cf6',
    background: 'rgba(139, 92, 246, 0.08)',
  },
  dropOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(139, 92, 246, 0.15)',
    borderRadius: '14px',
    color: '#c4b5fd',
    fontSize: '1.2rem',
    fontWeight: 700,
    zIndex: 2,
    pointerEvents: 'none',
  },
  visionDropZone: {
    textAlign: 'center',
    padding: '40px 20px',
    border: '2px dashed #3b3b5c',
    borderRadius: '16px',
    margin: 'auto 0',
  },
  visionDropTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#c4b5fd',
    marginBottom: '12px',
  },
  visionDropHint: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    marginBottom: '6px',
  },
  messageImage: {
    maxWidth: '100%',
    maxHeight: '280px',
    borderRadius: '10px',
    marginBottom: '8px',
    border: '1px solid #2e2e4a',
    objectFit: 'contain',
  },
  imagePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    marginBottom: '12px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid #3b3b5c',
    borderRadius: '12px',
  },
  previewThumb: {
    maxHeight: '120px',
    borderRadius: '8px',
    border: '1px solid #2e2e4a',
  },
  previewInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    fontSize: '0.85rem',
    color: '#c4b5fd',
  },
  removeImageButton: {
    border: 'none',
    background: 'rgba(248, 113, 113, 0.2)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  imageError: {
    color: '#f87171',
    fontSize: '0.85rem',
    marginBottom: '12px',
    padding: '8px 12px',
    background: 'rgba(248, 113, 113, 0.1)',
    borderRadius: '8px',
  },
  comparisonPanel: {
    marginBottom: '16px',
    padding: '16px',
    background: 'rgba(15, 15, 26, 0.5)',
    border: '1px solid #2e2e4a',
    borderRadius: '14px',
  },
  comparisonTitle: {
    fontSize: '1rem',
    color: '#c4b5fd',
    marginBottom: '12px',
    textAlign: 'center',
  },
  comparisonGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  comparisonItem: {
    textAlign: 'center',
  },
  comparisonLabel: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#94a3b8',
    marginBottom: '8px',
    fontWeight: 600,
  },
  comparisonImage: {
    maxWidth: '100%',
    borderRadius: '12px',
    border: '1px solid #2e2e4a',
  },
  comparisonLoading: {
    padding: '40px 16px',
    color: '#c4b5fd',
    fontSize: '0.9rem',
    border: '2px dashed #3b3b5c',
    borderRadius: '12px',
  },
  comparisonPlaceholder: {
    color: '#64748b',
    fontSize: '0.85rem',
    padding: '20px',
  },
  attachButton: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#06b6d4',
    fontSize: '1.1rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: '12px 16px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  badge: {
    display: 'inline-block',
    marginBottom: '8px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '8px',
  },
  responseBadge: {
    background: 'rgba(6, 182, 212, 0.15)',
    color: '#06b6d4',
    border: '1px solid #0891b2',
  },
  modelBadgeFlash: {
    background: 'rgba(139, 92, 246, 0.15)',
    color: '#c4b5fd',
    border: '1px solid #8b5cf6',
  },
  modelBadgePro: {
    background: 'rgba(6, 182, 212, 0.15)',
    color: '#06b6d4',
    border: '1px solid #0891b2',
  },
  userBubble: {
    background: 'rgba(139, 92, 246, 0.2)',
    color: '#f1f5f9',
    borderRadius: '16px 16px 4px 16px',
    border: '1px solid #8b5cf6',
  },
  assistantBubble: {
    background: '#16162a',
    color: '#f1f5f9',
    border: '1px solid #2e2e4a',
    borderRadius: '16px 16px 16px 4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  thinkingBubble: {
    border: '1px solid rgba(139, 92, 246, 0.35)',
    background: 'rgba(139, 92, 246, 0.06)',
  },
  sources: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid #2e2e4a',
  },
  sourcesLabel: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sourcesList: {
    margin: 0,
    paddingLeft: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sourceLink: {
    color: '#06b6d4',
    fontSize: '0.85rem',
    textDecoration: 'underline',
    wordBreak: 'break-all',
  },
  knowledgeCitation: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid #2e2e4a',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.82rem',
    color: '#94a3b8',
  },
  knowledgeCitationIcon: {
    fontSize: '0.9rem',
  },
  knowledgeCitationLabel: {
    fontWeight: 600,
    color: '#64748b',
  },
  knowledgeCitationLink: {
    color: '#a78bfa',
    textDecoration: 'none',
    borderBottom: '1px dotted rgba(167, 139, 250, 0.5)',
  },
  modeSwitcher: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  modeButton: {
    flex: 1,
    minWidth: '140px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#94a3b8',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  modeButtonActive: {
    background: 'rgba(139, 92, 246, 0.2)',
    color: '#c4b5fd',
    border: '2px solid #8b5cf6',
    fontWeight: 600,
  },
  form: {
    display: 'flex',
    gap: '12px',
    paddingTop: '4px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #3b3b5c',
    background: '#16162a',
    color: '#f1f5f9',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    padding: '12px 20px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.35)',
  },
};
