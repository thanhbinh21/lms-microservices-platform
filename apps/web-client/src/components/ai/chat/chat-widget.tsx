'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/components/ai/hooks/use-chat';
import { useConversation, useConversations } from '@/components/ai/hooks/use-conversations';
import { cn } from '@/lib/utils';

interface ChatWidgetProps {
  courseId: string;
  lessonId?: string;
  aiAvailable?: boolean;
  aiUnavailableReason?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function ChatWidget({
  courseId,
  lessonId,
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
    setSelectedConversationId(null);
  }, [courseId, lessonId]);

  const setIsOpen = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen);
    else setInternalOpen(nextOpen);
  };

  const isDisabled = false;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg transition-all',
          'cursor-pointer hover:bg-primary/90 hover:shadow-xl',
          aiAvailable === false && 'ring-1 ring-amber-200',
          className,
        )}
        aria-label="Mở trợ lý AI"
        disabled={isDisabled}
        title={isDisabled ? (aiUnavailableReason || 'AI sẽ dùng ngữ cảnh hiện có của khóa học') : 'Mở trợ lý AI'}
      >
        <MessageSquare className="size-6" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex h-[600px] w-[420px] flex-col overflow-hidden rounded-xl',
        'border bg-background shadow-2xl',
        className,
      )}
    >
      <ChatPanel
        courseId={courseId}
        lessonId={lessonId}
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
  conversationId?: string;
  onClose: () => void;
  onSelectConversation: (id: string | null) => void;
}

export function ChatPanel({
  courseId,
  lessonId,
  conversationId,
  onClose,
  onSelectConversation,
}: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [messages, setMessages] = useState<{ id: string; role: string; content: string; isError?: boolean }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref giu noi dung streaming moi nhat de tranh stale closure trong onDone.
  const streamingRef = useRef('');
  const pendingMessageRef = useRef('');

  const { conversations, fetchConversations } = useConversations({ courseId });
  const { messages: loadedMessages, fetchMessages } = useConversation(conversationId ?? '');

  const {
    sendMessage,
    isStreaming,
    error,
  } = useChat({
    conversationId: conversationId ?? '',
    onChunk: (text) => {
      streamingRef.current += text;
      setStreamingContent((prev) => prev + text);
    },
    onDone: () => {
      const content = streamingRef.current;
      if (content) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content },
        ]);
        streamingRef.current = '';
        setStreamingContent('');
      }
    },
    onError: (errMsg) => {
      streamingRef.current = '';
      setStreamingContent('');
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: errMsg, isError: true },
      ]);
    },
    onMessageId: (id) => {
      // Reset ref truoc khi bat dau stream moi.
      streamingRef.current = '';
      setMessages((prev) => [
        ...prev,
        { id, role: 'user', content: pendingMessageRef.current || message },
      ]);
      setMessage('');
    },
  });

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      void fetchMessages();
    }
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    if (!conversationId) {
      void fetchConversations();
    }
  }, [conversationId, fetchConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!message.trim() || !conversationId || isStreaming) return;
    pendingMessageRef.current = message;
    await sendMessage(message, lessonId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <span className="text-sm font-semibold">Trợ lý AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Đóng">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Conversation list */}
      {!conversationId && (
        <ConversationList
          conversations={conversations}
          onSelect={(id) => onSelectConversation(id)}
          onNewConversation={() => {
            void createNewConversation(courseId, lessonId).then((id) => {
              if (id) onSelectConversation(id);
            });
          }}
        />
      )}

      {/* Chat area */}
      {conversationId && (
        <>
          {/* Back button */}
          <div className="border-b px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                onSelectConversation(null);
                void fetchConversations();
              }}
            >
              ← Quay lại danh sách
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadedMessages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {streamingContent && (
              <ChatBubble role="assistant" content={streamingContent} streaming />
            )}
            {isStreaming && !streamingContent && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                AI đang trả lời...
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi AI về bài học..."
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
                disabled={isStreaming}
              />
              <Button
                size="icon"
                className="size-9 shrink-0"
                onClick={() => void handleSend()}
                disabled={!message.trim() || isStreaming}
              >
                {isStreaming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Nhấn Enter để gửi, Shift+Enter để xuống dòng
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ChatBubble({ role, content, streaming }: { role: string; content: string; streaming?: boolean }) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
          streaming && 'animate-pulse',
        )}
      >
        {content.split('\n').map((line, i) => {
          if (!line) return <br key={i} />;
          // Basic markdown: bold, code, code blocks
          const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
          return (
            <span key={i}>
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                  return (
                    <code key={j} className="rounded bg-black/10 px-0.5 font-mono text-xs dark:bg-white/10">
                      {part.slice(1, -1)}
                    </code>
                  );
                }
                return part;
              })}
              {i < line.split('\n').length - 1 && <br />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  onSelect,
  onNewConversation,
}: {
  conversations: { id: string; title: string; updatedAt: string; _count?: { messages: number } }[];
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sm"
          onClick={onNewConversation}
        >
          <MessageSquare className="size-4" />
          Cuộc trò chuyện mới
        </Button>
      </div>

      {conversations.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground">
            Chưa có cuộc trò chuyện nào
          </p>
        </div>
      ) : (
        <div className="space-y-1 px-2 pb-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{conv.title}</p>
                <p className="text-xs text-muted-foreground">
                  {conv._count?.messages ?? 0} tin nhắn
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

async function createNewConversation(c: string, l?: string): Promise<string | null> {
  const { createAiConversationAction } = await import('@/app/actions/ai');
  const res = await createAiConversationAction(c, l);
  if (res.success && res.data) {
    return res.data.id;
  }
  return null;
}
