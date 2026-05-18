'use client';

import { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuizButtonProps {
  courseId: string;
  lessonId: string;
  lessonScore?: number;
  lessonTotal?: number;
  status?: 'AVAILABLE' | 'PROCESSING' | 'INSUFFICIENT_CONTENT' | 'TRANSCRIPT_NOT_READY' | 'DISABLED';
  reason?: string;
  onStartQuiz: () => void;
  className?: string;
}

export function QuizButton({
  courseId,
  lessonId,
  lessonScore,
  lessonTotal,
  status = 'AVAILABLE',
  reason,
  onStartQuiz,
  className,
}: QuizButtonProps) {
  const isLoading = status === 'PROCESSING';

  if (status === 'INSUFFICIENT_CONTENT' || status === 'DISABLED') {
    return (
      <div className={cn('rounded-lg border border-muted bg-muted/30 p-4', className)}>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-muted p-2">
            <Brain className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Kiểm tra kiến thức</p>
            <p className="text-xs text-muted-foreground">
              {reason || 'Quiz chưa khả dụng cho bài học này.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'TRANSCRIPT_NOT_READY') {
    return (
      <div className={cn('rounded-lg border border-amber-200 bg-amber-50 p-4', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800">AI đang xử lý nội dung</p>
            <p className="text-xs text-amber-600">Quiz sẽ khả dụng sau khi transcript sẵn sàng.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasPassed = lessonScore !== undefined && lessonTotal !== undefined && (lessonScore / lessonTotal) >= 0.7;

  return (
    <div className={cn('rounded-lg border border-primary/20 bg-primary/5 p-4', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Brain className="size-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Kiểm tra kiến thức</p>
              {hasPassed && (
                <Badge variant="default" className="bg-emerald-500 text-xs">
                  Đạt
                </Badge>
              )}
            </div>
            {lessonScore !== undefined && lessonTotal !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {hasPassed
                  ? `Điểm: ${Math.round((lessonScore / lessonTotal) * 100)}%`
                  : `Điểm cao nhất: ${Math.round((lessonScore / lessonTotal) * 100)}% — cần ≥70%`
                }
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">5 câu hỏi, cần ≥70% để đạt</p>
            )}
          </div>
        </div>
        <Button size="sm" onClick={onStartQuiz} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Làm quiz'}
        </Button>
      </div>
    </div>
  );
}
