'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuizQuestionDto {
  question: string;
  options: string[];
}

interface QuizQualityReportDto {
  warnings: string[];
}

interface QuizSubmitResultDto {
  score: number;
  correctQ: number;
  totalQ: number;
  passed: boolean;
  passScore: number;
  results: {
    questionIndex: number;
    question: string;
    options: string[];
    selected: number;
    correct: number;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  qualityReport?: QuizQualityReportDto;
}

interface QuizPanelProps {
  courseId: string;
  lessonId?: string;
  quizType: 'LESSON' | 'FINAL_COURSE';
  sessionId: string;
  questions: QuizQuestionDto[];
  expiresAt?: string;
  contextQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
  qualityReport?: QuizQualityReportDto;
  onClose: () => void;
  onSubmit: (answers: number[]) => Promise<{ success: boolean; data?: QuizSubmitResultDto | null; message?: string }>;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function qualityLabel(value?: 'HIGH' | 'MEDIUM' | 'LOW') {
  if (value === 'HIGH') return 'Ngữ cảnh tốt';
  if (value === 'MEDIUM') return 'Ngữ cảnh vừa đủ';
  if (value === 'LOW') return 'Ngữ cảnh mỏng';
  return null;
}

export function QuizPanel({
  quizType,
  questions,
  expiresAt,
  contextQuality,
  qualityReport,
  onClose,
  onSubmit,
}: QuizPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizSubmitResultDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt || submitted) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, submitted]);

  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : undefined;
  const timeLeftMs = expiresAtMs ? expiresAtMs - now : 0;
  const expired = Boolean(expiresAtMs && timeLeftMs <= 0);
  const current = questions[currentIndex];
  const answeredCount = answers.filter((a) => a !== null).length;
  const canSubmit = answeredCount === questions.length;

  const qualityBadge = useMemo(() => {
    const label = qualityLabel(contextQuality);
    if (!label) return null;
    const className = contextQuality === 'HIGH'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : contextQuality === 'MEDIUM'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
    return <Badge variant="outline" className={cn('h-6 text-[11px]', className)}>{label}</Badge>;
  }, [contextQuality]);

  const handleSelect = (optionIndex: number) => {
    if (submitted) return;
    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = optionIndex;
    setAnswers(nextAnswers);
  };

  const requestSubmit = () => {
    if (!canSubmit || submitting) return;
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setConfirmOpen(false);
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

  if (questions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="size-8 text-amber-600" />
        <div>
          <p className="text-sm font-semibold">Chưa có câu hỏi hợp lệ</p>
          <p className="mt-1 text-xs text-muted-foreground">AI chưa tạo được phiên quiz từ ngữ cảnh hiện có.</p>
        </div>
        <Button onClick={onClose}>Đóng</Button>
      </div>
    );
  }

  if (expired && !submitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-amber-100 p-4">
          <Clock3 className="size-8 text-amber-600" />
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
    return <QuizResult result={result} onClose={onClose} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              {quizType === 'FINAL_COURSE' ? 'Bài kiểm tra cuối khóa' : 'Kiểm tra kiến thức'}
            </p>
            {qualityBadge}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Câu {currentIndex + 1} / {questions.length} · {answeredCount} đã trả lời
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expiresAt ? (
            <Badge variant="outline" className="h-7 gap-1 text-xs">
              <Clock3 className="size-3" />
              {formatTime(timeLeftMs)}
            </Badge>
          ) : null}
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Đóng quiz">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="border-b p-3">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {questions.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'h-8 rounded-md border text-xs font-semibold transition-colors',
                currentIndex === index && 'border-primary bg-primary text-primary-foreground',
                currentIndex !== index && answers[index] !== null && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                currentIndex !== index && answers[index] === null && 'bg-background hover:bg-muted',
              )}
              aria-label={`Câu ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        {qualityReport?.warnings?.length ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            AI đã lọc câu trùng/lỏng trước khi tạo phiên quiz.
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-base font-medium leading-relaxed">
          {current.question}
        </p>

        <div className="space-y-2">
          {current.options.map((option, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(idx)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-all',
                answers[currentIndex] === idx
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-input hover:border-primary/50 hover:bg-muted/50',
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

      <div className="border-t p-4">
        {error ? <p className="mb-3 text-xs font-semibold text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between gap-3">
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
              onClick={requestSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Nộp bài
            </Button>
          )}
        </div>
      </div>

      {confirmOpen ? (
        <SubmitConfirmDialog
          answeredCount={answeredCount}
          totalQuestions={questions.length}
          submitting={submitting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleSubmit()}
        />
      ) : null}
    </div>
  );
}

function SubmitConfirmDialog({
  answeredCount,
  totalQuestions,
  submitting,
  onCancel,
  onConfirm,
}: {
  answeredCount: number;
  totalQuestions: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-quiz-title"
        className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="submit-quiz-title" className="text-base font-semibold">Nộp bài kiểm tra?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bạn đã trả lời {answeredCount}/{totalQuestions} câu. Sau khi nộp, đáp án sẽ không thể chỉnh sửa.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Kiểm tra lại
          </Button>
          <Button type="button" onClick={onConfirm} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Nộp bài
          </Button>
        </div>
      </div>
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
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Kết quả bài kiểm tra</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className={cn(
              'mb-3 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold',
              result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
          >
            {percent}%
          </div>

          <div className="mb-4">
            <p className={cn('text-lg font-bold', result.passed ? 'text-emerald-700' : 'text-red-700')}>
              {result.passed ? 'Đạt yêu cầu' : 'Chưa đạt'}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.correctQ} / {result.totalQ} câu đúng · Cần ≥{result.passScore}% để đạt
            </p>
          </div>

          <Badge
            variant={result.passed ? 'default' : 'destructive'}
            className={cn('px-3 py-1 text-sm', result.passed && 'bg-emerald-600')}
          >
            {result.passed ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-4" />
                Có thể xét chứng chỉ
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="size-4" />
                Cần ôn lại
              </span>
            )}
          </Badge>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Chi tiết câu hỏi</p>
          {result.results.map((r) => (
            <Card key={r.questionIndex} className={cn(!r.isCorrect && 'border-red-200')}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">
                    Câu {r.questionIndex + 1}: {r.question}
                  </CardTitle>
                  {r.isCorrect ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-xs">
                <p className="text-muted-foreground">
                  Bạn chọn: <span className="font-semibold text-foreground">{String.fromCharCode(65 + r.selected)}. {r.selectedAnswer}</span>
                </p>
                {!r.isCorrect ? (
                  <p className="text-muted-foreground">
                    Đáp án đúng: <span className="font-semibold text-foreground">{String.fromCharCode(65 + r.correct)}. {r.correctAnswer}</span>
                  </p>
                ) : null}
                <p className="leading-relaxed text-muted-foreground">
                  {r.explanation}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="border-t p-4">
        <Button className="w-full" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </div>
  );
}
