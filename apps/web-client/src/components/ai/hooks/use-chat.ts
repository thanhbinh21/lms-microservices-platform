'use client';

import { useCallback, useRef, useState } from 'react';

interface UseChatOptions {
  conversationId: string;
  onChunk?: (text: string) => void;
  onDone?: (sources?: string[]) => void;
  onError?: (message: string) => void;
  onMessageId?: (id: string) => void;
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

function friendlyChatError(message?: string) {
  const raw = message || '';
  const lower = raw.toLowerCase();
  if (lower.includes('lesson does not belong to this course')) {
    return 'Ngữ cảnh bài học không còn khớp với khóa học hiện tại. Hãy tạo cuộc trò chuyện mới rồi thử lại.';
  }
  if (lower.includes('conversation') && lower.includes('course')) {
    return 'Cuộc trò chuyện đang dùng ngữ cảnh cũ. Hãy tạo cuộc trò chuyện mới để đồng bộ với bài học hiện tại.';
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden')) {
    return 'Phiên đăng nhập đã hết hạn hoặc bạn chưa có quyền dùng trợ lý AI cho khóa học này.';
  }
  if (lower.includes('quota') || lower.includes('rate limit')) {
    return 'AI đang bị giới hạn lượt dùng tạm thời. Vui lòng thử lại sau ít phút.';
  }
  if (lower.includes('failed to fetch')) {
    return 'Không kết nối được AI Service. Kiểm tra Kong Gateway và AI Service rồi thử lại.';
  }
  return raw || 'AI chưa thể trả lời lúc này. Vui lòng thử lại.';
}

export function useChat(options: UseChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState('');
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    content: string,
    lessonId?: string,
    currentTimeSec?: number,
  ) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setStreamingContent('');
    setError('');

    try {
      const response = await fetch(
        `${GATEWAY_URL}/ai/api/chat/conversations/${options.conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            content,
            lessonId,
            currentTimeSec: currentTimeSec !== undefined ? Math.floor(currentTimeSec) : undefined,
          }),
          signal: controller.signal,
        },
      );

      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      if (remaining) setRateLimitRemaining(Number.parseInt(remaining, 10));
      if (reset) setRateLimitReset(Number.parseInt(reset, 10));

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        const errMsg = friendlyChatError(json.message);
        setError(errMsg);
        options.onError?.(errMsg);
        return;
      }

      if (!response.body) {
        const errMsg = 'AI Service không trả về nội dung. Vui lòng thử lại.';
        setError(errMsg);
        options.onError?.(errMsg);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
          const eventLine = lines.find((line) => line.startsWith('event: '));
          const dataLines = lines.filter((line) => line.startsWith('data: '));
          if (!eventLine || dataLines.length === 0) continue;

          const eventName = eventLine.slice('event: '.length).trim();
          const dataStr = dataLines.map((line) => line.slice('data: '.length)).join('\n').trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (eventName === 'message_id' && data.messageId) {
              options.onMessageId?.(data.messageId);
            } else if (eventName === 'chunk' && data.text) {
              setStreamingContent((prev) => prev + data.text);
              options.onChunk?.(data.text);
            } else if (eventName === 'done') {
              options.onDone?.(data.sources);
            } else if (eventName === 'error') {
              const errMsg = friendlyChatError(data.message);
              setError(errMsg);
              options.onError?.(errMsg);
            }
          } catch {
            // SSE co the bi cat nho theo chunk; bo qua block loi de tiep tuc stream.
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errMsg = friendlyChatError((err as Error).message);
      setError(errMsg);
      options.onError?.(errMsg);
    } finally {
      setIsStreaming(false);
    }
  }, [options]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  return {
    sendMessage,
    cancelStream,
    isStreaming,
    streamingContent,
    error,
    rateLimitRemaining,
    rateLimitReset,
  };
}
