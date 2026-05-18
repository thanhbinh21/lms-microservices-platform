'use client';

import { useState, useCallback, useRef } from 'react';

interface UseChatOptions {
  conversationId: string;
  onChunk?: (text: string) => void;
  onDone?: (sources?: string[]) => void;
  onError?: (message: string) => void;
  onMessageId?: (id: string) => void;
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

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
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setStreamingContent('');
    setError('');

    try {
      const res = await fetch(
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

      // Read rate limit headers
      const remaining = res.headers.get('X-RateLimit-Remaining');
      const reset = res.headers.get('X-RateLimit-Reset');
      if (remaining) setRateLimitRemaining(parseInt(remaining, 10));
      if (reset) setRateLimitReset(parseInt(reset, 10));

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message || 'Lỗi gửi tin nhắn');
        setIsStreaming(false);
        return;
      }

      if (!res.body) {
        setError('Không có phản hồi từ server');
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('event: ')) continue;
          const colonIdx = line.indexOf(':');
          if (colonIdx === -1) continue;

          const eventName = line.slice(colonIdx + 1).trim();
          const dataLineIdx = lines.indexOf(line) + 1;
          if (dataLineIdx >= lines.length) continue;

          const dataLine = lines[dataLineIdx];
          if (!dataLine.startsWith('data: ')) continue;

          const dataStr = dataLine.slice(6).trim();
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
              setError(data.message || 'Đã xảy ra lỗi');
              options.onError?.(data.message);
            }
          } catch {
            // skip malformed SSE data
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Stream was cancelled
        return;
      }
      setError('Lỗi kết nối. Vui lòng thử lại.');
      options.onError?.('Lỗi kết nối. Vui lòng thử lại.');
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
