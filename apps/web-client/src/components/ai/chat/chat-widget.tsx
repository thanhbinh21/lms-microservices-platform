'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Plus, RotateCcw, Send, X } from 'lucide-react';
import { createAiConversationAction } from '@/app/actions/ai';
import { useChat } from '@/components/ai/hooks/use-chat';
import { useConversation, useConversations } from '@/components/ai/hooks/use-conversations';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
    <div className={cn('fixed bottom-6 right-6 z-50 flex h-[min(600px,calc(100vh-3rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl', className)}>
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

export function ChatPanel({ courseId, lessonId, conversationId, onClose, onSelectConversation }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [localMessages, setLocalMessages] = useState<{ id: string; role: string; content: string; isError?: boolean }[]>([]);
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef('');
  const pendingMessageRef = useRef('');

  const { conversations, loading: conversationsLoading, error: conversationsError, fetchConversations } = useConversations({ courseId });
  const { messages: loadedMessages, loading: messagesLoading, fetchMessages } = useConversation(conversationId ?? '');

  const createConversation = async () => {
    if (creating) return;
    setCreating(true);
    const result = await createAiConversationAction(courseId, lessonId);
    setCreating(false);
    if (result.success && result.data) {
      setLocalMessages([]);
      onSelectConversation(result.data.id);
      return;
    }
    setLocalMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content: result.message || 'Không tạo được cuộc trò chuyện mới.', isError: true },
    ]);
  };

  const { sendMessage, isStreaming, error } = useChat({
    conversationId: conversationId ?? '',
    onChunk: (text) => {
      streamingRef.current += text;
      setStreamingContent((prev) => prev + text);
    },
    onDone: () => {
      const content = streamingRef.current;
      if (content) {
        setLocalMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content }]);
      }
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
      setMessage('');
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
  }, [loadedMessages, localMessages, streamingContent]);

  const handleSend = async () => {
    const content = message.trim();
    if (!content || isStreaming) return;
    if (!conversationId) {
      await createConversation();
      return;
    }
    pendingMessageRef.current = content;
    await sendMessage(content, lessonId);
  };

  const resetConversation = async () => {
    setLocalMessages([]);
    onSelectConversation(null);
    await fetchConversations();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Trợ lý AI</p>
            <p className="text-[11px] text-muted-foreground">Theo ngữ cảnh khóa học hiện tại</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={resetConversation} aria-label="Reset ngữ cảnh AI">
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
            <Button variant="ghost" size="sm" className="text-xs" onClick={resetConversation}>
              ← Danh sách trò chuyện
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={createConversation} disabled={creating}>
              {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Tạo mới
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messagesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Đang tải tin nhắn...
              </div>
            ) : null}
            {loadedMessages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {localMessages.map((msg) => (
              <ChatBubble key={msg.id} role={msg.role} content={msg.content} isError={msg.isError} onReset={msg.isError ? createConversation : undefined} />
            ))}
            {streamingContent ? <ChatBubble role="assistant" content={streamingContent} streaming /> : null}
            {isStreaming && !streamingContent ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                AI đang trả lời...
              </div>
            ) : null}
            {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t p-3">
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
              <Button size="icon" className="size-10 shrink-0" onClick={() => void handleSend()} disabled={!message.trim() || isStreaming}>
                {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Enter để gửi, Shift+Enter để xuống dòng.</p>
          </div>
        </>
      )}
    </div>
  );
}

function ChatBubble({
  role,
  content,
  streaming,
  isError,
  onReset,
}: {
  role: string;
  content: string;
  streaming?: boolean;
  isError?: boolean;
  onReset?: () => void;
}) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm', isUser ? 'bg-primary text-primary-foreground' : isError ? 'bg-red-50 text-red-700' : 'bg-muted', streaming && 'animate-pulse')}>
        {content.split('\n').map((line, index) => (
          <span key={index}>
            {line || <br />}
            {index < content.split('\n').length - 1 ? <br /> : null}
          </span>
        ))}
        {onReset ? (
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={onReset}>
              <RotateCcw className="size-3" />
              Tạo cuộc trò chuyện mới
            </Button>
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
