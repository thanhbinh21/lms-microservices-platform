'use client';

import { AlertCircle, ArrowRight, Trophy } from 'lucide-react';
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
        <CardContent className="flex items-start gap-4 p-4">
          <div className="rounded-full bg-amber-100 p-2">
            <AlertCircle className="size-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Bài kiểm tra tạm thời chưa sẵn sàng</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              AI Service hoặc dữ liệu quiz đang khởi động. Bạn có thể thử lại sau, tiến độ học không bị mất.
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
            <p className="text-sm font-semibold text-emerald-900">Bạn đã đạt bài kiểm tra cuối khóa</p>
            <p className="text-xs text-emerald-700">Điểm cao nhất: {quizBestScore}% · {quizAttemptCount ?? 0} lần thử</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-amber-200 bg-amber-50', className)}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="rounded-full bg-amber-100 p-2">
          <Trophy className="size-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">Bài kiểm tra cuối khóa đã mở</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            {quizAttemptCount && quizAttemptCount > 0
              ? `${quizAttemptCount} lần thử · cần đạt từ 70% để nhận chứng chỉ.`
              : 'Hoàn thành 15 câu hỏi và đạt từ 70% để nhận chứng chỉ khóa học.'}
          </p>
        </div>
        <Button size="sm" onClick={onStartFinalQuiz} className="shrink-0 gap-1 bg-amber-600 hover:bg-amber-700">
          Làm bài kiểm tra
          <ArrowRight className="size-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
