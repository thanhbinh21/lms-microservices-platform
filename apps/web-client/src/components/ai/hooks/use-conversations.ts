'use client';

import { useState, useCallback } from 'react';
import {
  type AiConversationDto,
  type AiMessageDto,
  listAiConversationsAction,
  getAiConversationAction,
  deleteAiConversationAction,
  getAiMessagesAction,
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
    const res = await listAiConversationsAction(options.courseId);
    setLoading(false);

    if (res.success && res.data) {
      setConversations(res.data.conversations);
    } else {
      setError(res.message || 'Không tải được cuộc trò chuyện');
    }
  }, [options.courseId]);

  const deleteConversation = useCallback(async (id: string) => {
    const res = await deleteAiConversationAction(id);
    if (res.success) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
    return res;
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
    setLoading(true);
    setError('');
    const res = await getAiMessagesAction(conversationId, cursor);
    setLoading(false);

    if (res.success && res.data) {
      if (cursor) {
        setMessages((prev) => [...res.data!.messages, ...prev]);
      } else {
        setMessages(res.data.messages);
      }
      setHasMore(res.data.hasMore);
      setNextCursor(res.data.nextCursor);
    } else {
      setError(res.message || 'Không tải được tin nhắn');
    }
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loading) return;
    await fetchMessages(nextCursor);
  }, [hasMore, nextCursor, loading, fetchMessages]);

  return { messages, loading, error, hasMore, nextCursor, fetchMessages, loadMore };
}
