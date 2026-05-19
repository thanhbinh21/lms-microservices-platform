'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface QuizQuestionDto {
  question: string;
  options: string[];
}

interface QuizSubmitResultDto {
  score: number;
  correctQ: number;
  totalQ: number;
  passed: boolean;
  passScore: number;
  results: {
    questionIndex: number;
    selected: number;
    correct: number;
    isCorrect: boolean;
    explanation: string;
  }[];
}

interface QuizPanelProps {
  courseId: string;
  lessonId?: string;
  quizType: 'LESSON' | 'FINAL_COURSE';
  sessionId: string;
  questions: QuizQuestionDto[];
  expiresAt?: string;
  onClose: () => void;
  onSubmit: (answers: number[]) => Promise<{ success: boolean; data?: QuizSubmitResultDto | null; message?: string }>;
}

export function QuizPanel({
  courseId,
  lessonId,
  quizType,
  sessionId,
  questions,
  expiresAt,
  onClose,
  onSubmit,
}: QuizPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizSubmitResultDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const current = questions[currentIndex];
  const answeredCount = answers.filter((a) => a !== null).length;
  const canSubmit = answeredCount === questions.length;

  const handleSelect = (optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');

    const res = await onSubmit(answers as number[]);
    setSubmitting(false);

    if (res.success && res.data) {
      setResult(res.data);
      setSubmitted(true);
    } else {
      setError(res.message || 'Lỗi nộp bài. Vui lòng thử lại.');
    }
  };

  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;

  if (expired && !submitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-amber-100 p-4">
          <Loader2 className="size-8 text-amber-600" />
        </div>
        <div>
          <p className="text-lg font-semibold">Quiz đã hết hạn</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quiz chỉ có hiệu lực trong 30 phút. Vui lòng tạo quiz mới.
          </p>
        </div>
        <Button onClick={onClose}>Đóng</Button>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <QuizResult result={result} onClose={onClose} />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">
            {quizType === 'FINAL_COURSE' ? 'Bài kiểm tra cuối khóa' : 'Kiểm tra kiến thức'}
          </p>
          <p className="text-xs text-muted-foreground">
            Câu {currentIndex + 1} / {questions.length} · {answeredCount} đã trả lời
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-base font-medium leading-relaxed">
          {current.question}
        </p>

        <div className="space-y-2">
          {current.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-all',
                answers[currentIndex] === idx
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-input hover:border-primary/50 hover:bg-muted/50',
                submitted && 'cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  answers[currentIndex] === idx
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30',
                )}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1 leading-relaxed">{option}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="size-4" />
          Câu trước
        </Button>

        {currentIndex < questions.length - 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          >
            Câu sau
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Nộp bài
          </Button>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}

function QuizResult({
  result,
  onClose,
}: {
  result: QuizSubmitResultDto;
  onClose: () => void;
}) {
  const percent = Math.round(result.score);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Kết quả bài kiểm tra</p>
      </div>

      {/* Score card */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className={cn(
              'mb-3 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold',
              result.passed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700',
            )}
          >
            {percent}%
          </div>

          <div className="mb-4">
            <p className={cn('text-lg font-bold', result.passed ? 'text-emerald-700' : 'text-red-700')}>
              {result.passed ? 'Chúc mừng! Bạn đã đạt' : 'Chưa đạt'}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.correctQ} / {result.totalQ} câu đúng · Cần ≥{result.passScore}% để đạt
            </p>
          </div>

          <Badge
            variant={result.passed ? 'default' : 'destructive'}
            className={cn('text-sm px-3 py-1', result.passed && 'bg-emerald-600')}
          >
            {result.passed ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-4" />
                Đạt yêu cầu
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="size-4" />
                Chưa đạt
              </span>
            )}
          </Badge>
        </div>

        {/* Question results */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Chi tiết câu hỏi</p>
          {result.results.map((r) => (
            <Card key={r.questionIndex} className={cn(!r.isCorrect && 'border-red-200')}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">
                    Câu {r.questionIndex + 1}
                  </CardTitle>
                  {r.isCorrect ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {!r.isCorrect && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Đáp án đúng: {String.fromCharCode(65 + r.correct)}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {r.explanation}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-4">
        <Button className="w-full" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </div>
  );
}
