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
    description: 'Hệ thống sẽ ưu tiên metadata, nội dung bài học và từ khóa khóa học để tạo quiz.',
    severity: 'info',
  },
  VIDEO_TOO_LARGE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Video quá dài để phân tích đầy đủ',
    description: 'Quiz vẫn có thể tạo từ metadata, nhưng chất lượng ngữ cảnh có thể giảm. Vui lòng thử lại.',
    severity: 'warning',
  },
  INSUFFICIENT_CONTENT: {
    icon: <AlertCircle className="size-4" />,
    title: 'Chưa tạo được quiz từ ngữ cảnh hiện có',
    description: 'AI đã thử dùng tiêu đề, mô tả và nội dung bài học. Vui lòng thử lại hoặc bổ sung nội dung bài học.',
    severity: 'warning',
  },
  INSUFFICIENT_COURSE_COVERAGE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Ngữ cảnh khóa học chưa đủ rộng',
    description: 'Hệ thống không còn bắt buộc transcript, nhưng khóa học cần thêm nội dung để tạo câu hỏi tốt hơn.',
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
    title: 'Hệ thống kiểm tra tạm thời không khả dụng',
    description: 'Vui lòng thử lại sau ít phút. Tiến độ học tập của bạn không bị ảnh hưởng.',
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
    description: 'Vui lòng thử lại sau hoặc chuyển sang bài học khác.',
    severity: 'warning' as const,
  };

  return (
    <Card className={cn('border', severityStyles[config.severity], className)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('rounded-full p-1.5', iconStyles[config.severity])}>{config.icon}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{config.title}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-85">{config.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
