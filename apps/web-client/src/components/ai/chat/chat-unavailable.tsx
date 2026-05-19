'use client';

import { MessageSquare, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatUnavailableProps {
  reason: string;
  onClose: () => void;
}

const REASON_MESSAGES: Record<string, { title: string; description: string }> = {
  TRANSCRIPT_PROCESSING: {
    title: 'AI đang chuẩn bị ngữ cảnh',
    description: 'Hệ thống sẽ ưu tiên ngữ cảnh hiện có của khóa học trong lúc xử lý.',
  },
  TRANSCRIPT_FAILED: {
    title: 'Ngữ cảnh AI chưa sẵn sàng',
    description: 'Hệ thống vẫn có thể dùng title, mô tả và nội dung giảng viên cung cấp làm fallback.',
  },
  NEEDS_MANUAL_TRANSCRIPT: {
    title: 'Bài học chưa có nội dung chi tiết',
    description: 'AI sẽ dùng ngữ cảnh khóa học và từ khóa liên quan để hỗ trợ best-effort.',
  },
  VIDEO_TOO_LARGE: {
    title: 'Video cần được chia nhỏ',
    description: 'AI vẫn có thể trả lời từ metadata, nhưng chất lượng có thể thấp hơn.',
  },
  NO_CONTEXT: {
    title: 'Ngữ cảnh AI chưa sẵn sàng',
    description: 'Vui lòng thử lại sau hoặc bổ sung mô tả bài học.',
  },
  COURSE_SERVICE_UNAVAILABLE: {
    title: 'Hệ thống tạm thời không khả dụng',
    description: 'Vui lòng thử lại sau.',
  },
  INSUFFICIENT_CONTENT: {
    title: 'Ngữ cảnh bài học còn ít',
    description: 'AI sẽ dùng ngữ cảnh hiện có của bài học và mở rộng hợp lý theo chủ đề.',
  },
};

export function ChatUnavailable({ reason, onClose }: ChatUnavailableProps) {
  const config = REASON_MESSAGES[reason] ?? {
    title: 'Ngữ cảnh AI chưa sẵn sàng',
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
          {reason || 'AI đang chuẩn bị ngữ cảnh bài học...'}
        </p>
      </div>
    </div>
  );
}
