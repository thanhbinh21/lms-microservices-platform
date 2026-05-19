'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { generateQuizAction, submitQuizAction } from '@/app/actions/ai';
import { QuizPanel } from '@/components/ai/quiz/quiz-panel';
import { QuizUnavailable } from '@/components/ai/quiz/quiz-unavailable';
import { Button } from '@/components/ui/button';

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

    const res = await generateQuizAction(courseId, undefined, 'FINAL_COURSE', 15);
    setLoading(false);

    if (!res.success) {
      const msg = res.message || '';
      const lowerMsg = msg.toLowerCase();
      if (msg.includes('100%')) setUnavailableReason('COURSE_NOT_COMPLETED');
      else if (lowerMsg.includes('service') || lowerMsg.includes('unavailable') || lowerMsg.includes('không thể lấy')) {
        setUnavailableReason('COURSE_SERVICE_UNAVAILABLE');
      } else if (lowerMsg.includes('chưa có bài học') || lowerMsg.includes('empty')) {
        setUnavailableReason('EMPTY_COURSE');
      } else {
        setUnavailableReason('INSUFFICIENT_CONTENT');
      }
      return;
    }

    if (res.data) {
      setSessionId(res.data.sessionId);
      setQuestions(res.data.questions);
      setExpiresAt(res.data.expiresAt);
    }
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startQuiz();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startQuiz]);

  const handleSubmit = async (answers: number[]) => {
    if (!sessionId) return { success: false, message: 'No session' };
    return submitQuizAction(sessionId, answers);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tạo bài kiểm tra cuối khóa...</p>
      </div>
    );
  }

  if (unavailableReason) {
    return (
      <div className="mx-auto max-w-md py-8">
        <QuizUnavailable reason={unavailableReason} />
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => router.back()}>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionId || questions.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Không thể tạo bài kiểm tra.</p>
        <Button onClick={() => void startQuiz()}>Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Bài kiểm tra cuối khóa</h1>
        <p className="text-sm text-muted-foreground">
          15 câu hỏi · Cần đạt ≥70% để nhận chứng chỉ
        </p>
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
