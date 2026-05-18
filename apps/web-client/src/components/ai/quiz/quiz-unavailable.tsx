'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuizUnavailableProps {
  reason: string;
  className?: string;
}

const REASONS: Record<string, { icon: React.ReactNode; title: string; description: string; severity: 'info' | 'warning' | 'error' }> = {
  TRANSCRIPT_NOT_READY: {
    icon: <Loader2 className="size-4 animate-spin" />,
    title: 'AI đang xử lý nội dung bài học',
    description: 'Quiz sẽ khả dụng sau khi transcript được tạo xong.',
    severity: 'info',
  },
  VIDEO_TOO_LARGE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Video quá lớn để tạo quiz',
    description: 'Video vượt giới hạn xử lý (60 phút / 500MB). Giảng viên cần chia nhỏ video.',
    severity: 'warning',
  },
  INSUFFICIENT_CONTENT: {
    icon: <AlertCircle className="size-4" />,
    title: 'Bài học chưa có đủ nội dung',
    description: 'Cần ít nhất 1000 ký tự nội dung text để tạo quiz.',
    severity: 'warning',
  },
  INSUFFICIENT_COURSE_COVERAGE: {
    icon: <AlertCircle className="size-4" />,
    title: 'Chưa đủ bài học có nội dung',
    description: 'Cần ≥50% bài học có transcript/nội dung text. Giảng viên cần bổ sung.',
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
