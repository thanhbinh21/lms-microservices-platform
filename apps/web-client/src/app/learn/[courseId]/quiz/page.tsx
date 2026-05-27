'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { generateQuizAction, submitQuizAction } from '@/app/actions/ai';
import { QuizPanel } from '@/components/ai/quiz/quiz-panel';
import { QuizUnavailable } from '@/components/ai/quiz/quiz-unavailable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FinalQuizPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<{ question: string; options: string[] }[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  const startQuiz = useCallback(async () => {
    setLoading(true);
    setUnavailableReason(null);
    setSessionId(null);
    setQuestions([]);

    const result = await generateQuizAction(courseId, undefined, 'FINAL_COURSE', 15);
    setLoading(false);

    if (!result.success || !result.data) {
      const message = result.message || '';
      const lowerMessage = message.toLowerCase();
      if (message.includes('100%')) setUnavailableReason('COURSE_NOT_COMPLETED');
      else if (lowerMessage.includes('service') || lowerMessage.includes('unavailable') || lowerMessage.includes('không thể lấy')) setUnavailableReason('COURSE_SERVICE_UNAVAILABLE');
      else if (lowerMessage.includes('chưa có bài học') || lowerMessage.includes('empty')) setUnavailableReason('EMPTY_COURSE');
      else setUnavailableReason('INSUFFICIENT_CONTENT');
      return;
    }

    setSessionId(result.data.sessionId);
    setQuestions(result.data.questions);
    setExpiresAt(result.data.expiresAt);
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void startQuiz(), 0);
    return () => window.clearTimeout(timer);
  }, [startQuiz]);

  const handleSubmit = async (answers: number[]) => {
    if (!sessionId) return { success: false, message: 'Phiên quiz không hợp lệ.' };
    return submitQuizAction(sessionId, answers);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">Đang tạo bài kiểm tra cuối khóa</p>
          <p className="mt-1 text-xs text-muted-foreground">AI đang tổng hợp ngữ cảnh từ khóa học và bài học đã xuất bản.</p>
        </div>
      </div>
    );
  }

  if (unavailableReason) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <QuizUnavailable reason={unavailableReason} />
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void startQuiz()}>
            <RotateCcw className="size-4" />
            Thử lại
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionId || questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-amber-800">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Không tạo được bài kiểm tra</p>
              <p className="mt-1 text-xs">Phiên quiz không có câu hỏi hợp lệ. Vui lòng thử lại.</p>
            </div>
          </CardContent>
        </Card>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => void startQuiz()}>Thử lại</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Bài kiểm tra cuối khóa</h1>
        <p className="text-sm text-muted-foreground">15 câu hỏi · cần đạt từ 70% để nhận chứng chỉ.</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <QuizPanel
          courseId={courseId}
          lessonId={undefined}
          quizType="FINAL_COURSE"
          sessionId={sessionId}
          questions={questions}
          expiresAt={expiresAt}
          onClose={() => router.back()}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
