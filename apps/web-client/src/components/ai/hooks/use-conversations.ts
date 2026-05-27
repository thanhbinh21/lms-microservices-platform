'use client';

import { useCallback, useState } from 'react';
import {
  deleteAiConversationAction,
  getAiMessagesAction,
  listAiConversationsAction,
  type AiConversationDto,
  type AiMessageDto,
} from '@/app/actions/ai';

interface UseConversationsOptions {
  courseId?: string;
}

export function useConversations(options: UseConversationsOptions = {}) {
  const [conversations, setConversations] = useState<AiConversationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await listAiConversationsAction(options.courseId);
    setLoading(false);

    if (result.success && result.data) {
      setConversations(result.data.conversations);
    } else {
      setError(result.message || 'Không tải được danh sách trò chuyện.');
    }
  }, [options.courseId]);

  const deleteConversation = useCallback(async (id: string) => {
    const result = await deleteAiConversationAction(id);
    if (result.success) {
      setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
    }
    return result;
  }, []);

  return { conversations, loading, error, fetchConversations, deleteConversation };
}

export function useConversation(conversationId: string) {
  const [messages, setMessages] = useState<AiMessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const fetchMessages = useCallback(async (cursor?: string) => {
    if (!conversationId) return;
    setLoading(true);
    setError('');
    const result = await getAiMessagesAction(conversationId, cursor);
    setLoading(false);

    if (result.success && result.data) {
      if (cursor) setMessages((prev) => [...result.data!.messages, ...prev]);
      else setMessages(result.data.messages);
      setHasMore(result.data.hasMore);
      setNextCursor(result.data.nextCursor);
    } else {
      setMessages([]);
      setError(result.message || 'Không tải được tin nhắn.');
    }
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loading) return;
    await fetchMessages(nextCursor);
  }, [fetchMessages, hasMore, loading, nextCursor]);

  return { messages, loading, error, hasMore, nextCursor, fetchMessages, loadMore };
}
