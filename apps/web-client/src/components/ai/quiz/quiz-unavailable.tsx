'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuizUnavailableProps {
  reason: string;
  className?: string;
}

const REASONS: Record<string, { icon: ReactNode; title: string; description: string; severity: 'info' | 'warning' | 'error' }> = {
  TRANSCRIPT_NOT_READY: {
    icon: <Loader2 className="size-4 animate-spin" />,
    title: 'AI đang chuẩn bị ngữ cảnh',
    description: 'Hệ thống sẽ dùng title, mô tả, nội dung bài học và từ khóa khóa học để tạo quiz.',
    severity: 'info',
  },
  VIDEO_TOO_LARGE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Video cần được chia nhỏ',
    description: 'Quiz vẫn có thể tạo từ metadata, nhưng video quá dài có thể làm giảm chất lượng ngữ cảnh.',
    severity: 'warning',
  },
  INSUFFICIENT_CONTENT: {
    icon: <AlertCircle className="size-4" />,
    title: 'Chưa tạo được quiz từ ngữ cảnh hiện có',
    description: 'AI đã thử dùng title, mô tả và nội dung giảng viên cung cấp. Vui lòng thử lại sau hoặc bổ sung mô tả bài học.',
    severity: 'warning',
  },
  INSUFFICIENT_COURSE_COVERAGE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Ngữ cảnh khóa học chưa sẵn sàng',
    description: 'Hệ thống đang dùng cơ chế best-effort từ metadata khóa học, không còn yêu cầu transcript.',
    severity: 'warning',
  },
  EMPTY_COURSE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Khóa học chưa có bài học',
    description: 'Cần có ít nhất một bài học được xuất bản để tạo quiz cuối khóa.',
    severity: 'warning',
  },
  COURSE_NOT_COMPLETED: {
    icon: <Lock className="size-4" />,
    title: 'Cần hoàn thành 100% bài học',
    description: 'Bạn cần hoàn thành tất cả bài học trước khi làm bài kiểm tra cuối khóa.',
    severity: 'info',
  },
  COURSE_SERVICE_UNAVAILABLE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Hệ thống tạm thời không khả dụng',
    description: 'Vui lòng thử lại sau.',
    severity: 'error',
  },
};

const severityStyles = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-800',
};

const iconStyles = {
  info: 'bg-blue-100 text-blue-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
};

export function QuizUnavailable({ reason, className }: QuizUnavailableProps) {
  const config = REASONS[reason] ?? {
    icon: <AlertCircle className="size-4" />,
    title: 'Quiz chưa khả dụng',
    description: reason,
    severity: 'warning' as const,
  };

  return (
    <Card className={cn('border', severityStyles[config.severity], className)}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn('rounded-full p-1.5', iconStyles[config.severity])}>
          {config.icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{config.title}</p>
          <p className="text-xs opacity-80">{config.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
