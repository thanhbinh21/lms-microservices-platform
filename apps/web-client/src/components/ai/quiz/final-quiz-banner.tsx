'use client';

import { useEffect } from 'react';
import { Trophy, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FinalQuizBannerProps {
  courseId: string;
  progressPercent: number;
  quizBestScore?: number;
  quizAttemptCount?: number;
  serviceAvailable?: boolean;
  onStartFinalQuiz: () => void;
  className?: string;
}

export function FinalQuizBanner({
  courseId,
  progressPercent,
  quizBestScore,
  quizAttemptCount,
  serviceAvailable = true,
  onStartFinalQuiz,
  className,
}: FinalQuizBannerProps) {
  const isCompleted = progressPercent >= 100;
  const hasPassed = quizBestScore !== undefined && quizBestScore >= 70;

  if (!isCompleted) return null;

  if (!serviceAvailable) {
    return (
      <Card className={cn('border-amber-200 bg-amber-50', className)}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-full bg-amber-100 p-2">
            <AlertCircle className="size-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Hệ thống kiểm tra tạm không khả dụng</p>
            <p className="text-xs text-amber-600">
              Vui lòng thử lại sau để hoàn thành bài kiểm tra cuối khóa.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasPassed) {
    return (
      <Card className={cn('border-emerald-200 bg-emerald-50', className)}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-full bg-emerald-100 p-2">
            <Trophy className="size-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Bạn đã hoàn thành bài kiểm tra cuối khóa
            </p>
            <p className="text-xs text-emerald-600">
              Điểm cao nhất: {quizBestScore}% · {quizAttemptCount ?? 0} lần thử
            </p>
          </div>
          <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700">
            Xem chứng chỉ
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-amber-200 bg-amber-50', className)}>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="rounded-full bg-amber-100 p-2">
          <Trophy className="size-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-amber-800">Bài kiểm tra cuối khóa</p>
            {quizBestScore !== undefined && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                {quizBestScore}%
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-amber-700">
            {quizAttemptCount && quizAttemptCount > 0
              ? `${quizAttemptCount} lần thử · Cần đạt ≥70% để nhận chứng chỉ`
              : 'Hoàn thành bài kiểm tra (15 câu, ≥70%) để nhận chứng chỉ khóa học'
            }
          </p>
        </div>
        <Button
          size="sm"
          onClick={onStartFinalQuiz}
          className="shrink-0 gap-1 bg-amber-600 hover:bg-amber-700"
        >
          Làm bài kiểm tra
          <ArrowRight className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
