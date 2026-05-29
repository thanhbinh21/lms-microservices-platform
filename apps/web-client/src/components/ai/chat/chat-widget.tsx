'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Loader2, MessageSquare, Plus, RotateCcw, Send, Sparkles, Square, X } from 'lucide-react';
import { createAiConversationAction } from '@/app/actions/ai';
import { useChat, type ChatAgentStep } from '@/components/ai/hooks/use-chat';
import { useConversation, useConversations } from '@/components/ai/hooks/use-conversations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatWidgetProps {
  courseId: string;
  lessonId?: string;
  currentTimeSec?: number;
  aiAvailable?: boolean;
  aiUnavailableReason?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  sources?: string[];
};

const DEFAULT_PROMPTS = [
  'Tóm tắt ý chính của bài học này.',
  'Cho tôi một ví dụ thực tế dễ hiểu.',
  'Tôi nên học tiếp phần nào sau bài này?',
];

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    COURSE_METADATA: 'Khóa học',
    LESSON_METADATA: 'Bài học',
    LESSON_CONTENT: 'Nội dung',
    KEYWORD_CONTEXT: 'Từ khóa',
    AUTO_CONTEXT: 'Ngữ cảnh tự động',
    LEXICAL_COURSE_SEARCH: 'Tìm trong khóa',
    LEARNING_PROGRESS: 'Tiến độ',
    QUIZ_HISTORY: 'Quiz',
  };
  return labels[source] || source.replaceAll('_', ' ');
}

export function ChatWidget({
  courseId,
  lessonId,
  currentTimeSec,
  aiAvailable = true,
  aiUnavailableReason,
  open,
  onOpenChange,
  className,
}: ChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const isOpen = open ?? internalOpen;

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedConversationId(null), 0);
    return () => window.clearTimeout(timer);
  }, [courseId, lessonId]);

  const setIsOpen = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen);
    else setInternalOpen(nextOpen);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl',
          aiAvailable === false && 'ring-2 ring-amber-300',
          className,
        )}
        aria-label="Mở trợ lý AI"
        title={aiAvailable === false ? (aiUnavailableReason || 'AI sẽ dùng ngữ cảnh hiện có của khóa học') : 'Mở trợ lý AI'}
      >
        <MessageSquare className="size-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background sm:left-auto sm:w-[440px] sm:border-l sm:shadow-2xl">
      <ChatPanel
        courseId={courseId}
        lessonId={lessonId}
        currentTimeSec={currentTimeSec}
        conversationId={selectedConversationId ?? undefined}
        onClose={() => setIsOpen(false)}
        onSelectConversation={setSelectedConversationId}
      />
    </div>
  );
}

interface ChatPanelProps {
  courseId: string;
  lessonId?: string;
  currentTimeSec?: number;
  conversationId?: string;
  onClose: () => void;
  onSelectConversation: (id: string | null) => void;
}

export function ChatPanel({
  courseId,
  lessonId,
  currentTimeSec,
  conversationId,
  onClose,
  onSelectConversation,
}: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [creating, setCreating] = useState(false);
  const [agentSteps, setAgentSteps] = useState<ChatAgentStep[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [contextQuality, setContextQuality] = useState<'HIGH' | 'MEDIUM' | 'LOW' | undefined>();
  const [lastUserMessage, setLastUserMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef('');
  const pendingMessageRef = useRef('');

  const { conversations, loading: conversationsLoading, error: conversationsError, fetchConversations } = useConversations({ courseId });
  const { messages: loadedMessages, loading: messagesLoading, fetchMessages } = useConversation(conversationId ?? '');

  const hasConversationContent = loadedMessages.length > 0 || localMessages.length > 0 || Boolean(streamingContent);

  const createConversation = async () => {
    if (creating) return null;
    setCreating(true);
    const result = await createAiConversationAction(courseId, lessonId);
    setCreating(false);
    if (result.success && result.data) {
      setLocalMessages([]);
      setAgentSteps([]);
      setSources([]);
      onSelectConversation(result.data.id);
      return result.data.id;
    }
    setLocalMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: result.message || 'Không tạo được cuộc trò chuyện mới.', isError: true },
    ]);
    return null;
  };

  const { sendMessage, cancelStream, isStreaming, error } = useChat({
    conversationId: conversationId ?? '',
    onChunk: (text) => {
      streamingRef.current += text;
      setStreamingContent((prev) => prev + text);
    },
    onDone: (payload) => {
      const content = streamingRef.current;
      if (content) {
        setLocalMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          sources: payload?.sources,
        }]);
      }
      setSources(payload?.sources || []);
      setContextQuality(payload?.contextQuality);
      streamingRef.current = '';
      setStreamingContent('');
    },
    onError: (messageText) => {
      streamingRef.current = '';
      setStreamingContent('');
      setLocalMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: messageText, isError: true }]);
    },
    onMessageId: (id) => {
      streamingRef.current = '';
      setLocalMessages((prev) => [...prev, { id, role: 'user', content: pendingMessageRef.current || message }]);
      setLastUserMessage(pendingMessageRef.current || message);
      setMessage('');
    },
    onAgentStep: (step) => {
      setAgentSteps((prev) => [...prev.filter((item) => item.step !== step.step), step]);
    },
  });

  useEffect(() => {
    if (conversationId) void fetchMessages();
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    if (!conversationId) void fetchConversations();
  }, [conversationId, fetchConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [loadedMessages, localMessages, streamingContent, agentSteps]);

  const handleSend = async (override?: string) => {
    const content = (override ?? message).trim();
    if (!content || isStreaming) return;
    if (!conversationId) {
      await createConversation();
      setMessage(content);
      return;
    }
    pendingMessageRef.current = content;
    setAgentSteps([]);
    await sendMessage(content, lessonId, currentTimeSec);
  };

  const resetConversation = async () => {
    setLocalMessages([]);
    setAgentSteps([]);
    setSources([]);
    setContextQuality(undefined);
    onSelectConversation(null);
    await fetchConversations();
  };

  const retryLastMessage = async () => {
    if (!lastUserMessage) return;
    await handleSend(lastUserMessage);
  };

  const qualityBadge = useMemo(() => {
    if (!contextQuality) return null;
    const label = contextQuality === 'HIGH' ? 'Ngữ cảnh tốt' : contextQuality === 'MEDIUM' ? 'Ngữ cảnh vừa đủ' : 'Ngữ cảnh mỏng';
    const className = contextQuality === 'HIGH'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : contextQuality === 'MEDIUM'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
    return <Badge variant="outline" className={cn('h-6 text-[11px]', className)}>{label}</Badge>;
  }, [contextQuality]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Trợ lý học tập AI</p>
            <p className="truncate text-[11px] text-muted-foreground">Bám theo khóa học, bài học và tiến độ của bạn</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {qualityBadge}
          <Button variant="ghost" size="icon" className="size-8" onClick={resetConversation} aria-label="Đổi cuộc trò chuyện">
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Đóng trợ lý AI">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {!conversationId ? (
        <ConversationList
          conversations={conversations}
          loading={conversationsLoading}
          error={conversationsError}
          creating={creating}
          onSelect={onSelectConversation}
          onNewConversation={createConversation}
        />
      ) : (
        <>
          <div className="flex items-center justify-between border-b px-4 py-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetConversation}>
              Danh sách trò chuyện
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={createConversation} disabled={creating}>
              {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Tạo mới
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!hasConversationContent ? (
              <SuggestedPrompts onPick={(prompt) => void handleSend(prompt)} />
            ) : null}

            {messagesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Đang tải tin nhắn...
              </div>
            ) : null}

            {loadedMessages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} isError={msg.isError} sources={msg.sources} />
            ))}
            {localMessages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isError={msg.isError}
                sources={msg.sources}
                onRetry={msg.isError ? retryLastMessage : undefined}
              />
            ))}
            {agentSteps.length > 0 ? <AgentSteps steps={agentSteps} /> : null}
            {streamingContent ? <ChatBubble role="assistant" content={streamingContent} streaming /> : null}
            {isStreaming && !streamingContent ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                AI đang trả lời...
              </div>
            ) : null}
            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-3">
            {sources.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {sources.slice(0, 6).map((source) => (
                  <Badge key={source} variant="secondary" className="rounded-full text-[10px] font-medium">
                    {sourceLabel(source)}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Hỏi AI về bài học..."
                className="max-h-[120px] min-h-10 resize-none text-sm"
                rows={1}
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button size="icon" variant="outline" className="size-10 shrink-0" onClick={cancelStream} aria-label="Dừng trả lời">
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button size="icon" className="size-10 shrink-0" onClick={() => void handleSend()} disabled={!message.trim()}>
                  <Send className="size-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Enter để gửi, Shift+Enter để xuống dòng.</p>
          </div>
        </>
      )}
    </div>
  );
}

function SuggestedPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Gợi ý nhanh</p>
      <div className="grid gap-2">
        {DEFAULT_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-lg border bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgentSteps({ steps }: { steps: ChatAgentStep[] }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="space-y-1.5">
        {steps.map((step) => (
          <div key={step.step} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="flex-1">{step.label}</span>
            {typeof step.coverage === 'number' ? <span>{step.coverage}%</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '').trim();
          return (
            <pre key={index} className="overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50">
              <code>{code}</code>
            </pre>
          );
        }

        return part.split('\n').map((line, lineIndex) => (
          <p key={`${index}-${lineIndex}`} className="whitespace-pre-wrap leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        ));
      })}
    </div>
  );
}

function renderInlineMarkdown(line: string) {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{token.slice(1, -1)}</code>;
    }
    return <span key={index}>{token}</span>;
  });
}

function ChatBubble({
  role,
  content,
  streaming,
  isError,
  sources,
  onRetry,
}: {
  role: string;
  content: string;
  streaming?: boolean;
  isError?: boolean;
  sources?: string[];
  onRetry?: () => void;
}) {
  const isUser = role === 'user';

  const copyMessage = async () => {
    await navigator.clipboard?.writeText(content).catch(() => undefined);
  };

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'group max-w-[88%] rounded-xl px-3 py-2 text-sm',
        isUser ? 'bg-primary text-primary-foreground' : isError ? 'bg-red-50 text-red-700' : 'bg-muted',
        streaming && 'animate-pulse',
      )}>
        <MarkdownContent content={content} />
        {!isUser && sources?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {sources.slice(0, 4).map((source) => (
              <span key={source} className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                {sourceLabel(source)}
              </span>
            ))}
          </div>
        ) : null}
        {!isUser ? (
          <div className="mt-2 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <Button type="button" size="icon" variant="ghost" className="size-7" onClick={copyMessage} aria-label="Sao chép câu trả lời">
              <Copy className="size-3.5" />
            </Button>
            {onRetry ? (
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onRetry}>
                <RotateCcw className="size-3" />
                Thử lại
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  loading,
  error,
  creating,
  onSelect,
  onNewConversation,
}: {
  conversations: { id: string; title: string; updatedAt: string; _count?: { messages: number } }[];
  loading: boolean;
  error: string;
  creating: boolean;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3">
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-sm" onClick={onNewConversation} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Cuộc trò chuyện mới
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Đang tải trò chuyện...
        </div>
      ) : error ? (
        <div className="mx-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>
      ) : conversations.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground">Chưa có cuộc trò chuyện nào.</p>
        </div>
      ) : (
        <div className="space-y-1 px-2 pb-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{conversation.title}</p>
                <p className="text-xs text-muted-foreground">{conversation._count?.messages ?? 0} tin nhắn</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
