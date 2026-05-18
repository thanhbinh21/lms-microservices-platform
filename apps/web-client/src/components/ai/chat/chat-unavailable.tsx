'use client';

import { MessageSquare, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatUnavailableProps {
  reason: string;
  onClose: () => void;
}

const REASON_MESSAGES: Record<string, { title: string; description: string }> = {
  TRANSCRIPT_PROCESSING: {
    title: 'AI đang xử lý nội dung bài học',
    description: 'Vui lòng quay lại sau khi transcript được tạo xong.',
  },
  TRANSCRIPT_FAILED: {
    title: 'AI chưa khả dụng cho bài học này',
    description: 'Đã xảy ra lỗi khi xử lý video. Vui lòng liên hệ giảng viên.',
  },
  NEEDS_MANUAL_TRANSCRIPT: {
    title: 'Bài học chưa có transcript',
    description: 'Giảng viên chưa bổ sung transcript hoặc phụ đề cho bài học này.',
  },
  VIDEO_TOO_LARGE: {
    title: 'AI không khả dụng',
    description: 'Video quá dài và cần được chia nhỏ để AI xử lý.',
  },
  NO_CONTEXT: {
    title: 'AI chưa khả dụng cho bài học này',
    description: 'Bài học chưa có đủ nội dung text để AI trả lời câu hỏi.',
  },
  COURSE_SERVICE_UNAVAILABLE: {
    title: 'Hệ thống tạm thời không khả dụng',
    description: 'Vui lòng thử lại sau.',
  },
  INSUFFICIENT_CONTENT: {
    title: 'Bài học chưa có đủ nội dung',
    description: 'Cần ít nhất 1000 ký tự nội dung text để tạo quiz.',
  },
};

export function ChatUnavailable({ reason, onClose }: ChatUnavailableProps) {
  const config = REASON_MESSAGES[reason] ?? {
    title: 'AI chưa khả dụng cho bài học này',
    description: reason,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Trợ lý AI</span>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-full bg-muted p-3">
          <MessageSquare className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{config.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </div>
  );
}

export function ChatLoading({ reason }: { reason?: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Trợ lý AI</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">
          {reason || 'AI đang xử lý nội dung bài học...'}
        </p>
      </div>
    </div>
  );
}
