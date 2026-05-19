'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, Clock3, PlayCircle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Keyboard, ListChecks, X, Award, MessageSquare } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getLearnDataAction, updateLessonProgressAction, type LearnDataDto, type LearnLessonDto } from '@/app/actions/learning';
import { generateQuizAction, getAiContextStatusAction, submitQuizAction } from '@/app/actions/ai';
import { VideoPlayer } from '@/components/learning/video-player';
import { CourseQaSection } from '@/components/learning/course-qa-section';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatWidget } from '@/components/ai/chat/chat-widget';
import { QuizButton } from '@/components/ai/quiz/quiz-button';
import { QuizUnavailable } from '@/components/ai/quiz/quiz-unavailable';
import { QuizPanel } from '@/components/ai/quiz/quiz-panel';

function formatDuration(seconds: number) {
  if (!seconds) return '0 phút';
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}ph`;
  return `${m} phút`;
}

export default function LessonPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const [data, setData] = useState<LearnDataDto | null>(null);
  const [lesson, setLesson] = useState<LearnLessonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [certificateNumber, setCertificateNumber] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [qaExpanded, setQaExpanded] = useState(false);
  const [togglingComplete, setTogglingComplete] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<{ question: string; options: string[] }[]>([]);
  const [quizExpiresAt, setQuizExpiresAt] = useState<string | undefined>();
  const [quizUnavailableReason, setQuizUnavailableReason] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiUnavailableReason, setAiUnavailableReason] = useState<string | undefined>(undefined);
  const [chatOpen, setChatOpen] = useState(false);
  const hasTriggeredConfetti = useRef(false);

  const fetchData = useCallback(async () => {
    const res = await getLearnDataAction(courseId);
    if (res.success && res.data) {
      setData(res.data);
      const allLessons = res.data.chapters.flatMap((ch) => ch.lessons);
      const found = allLessons.find((l) => l.id === lessonId);
      setLesson(found || null);
      setCourseCompleted(res.data.progressPercent >= 100);
    }
    setLoading(false);
  }, [courseId, lessonId]);

  // Fetch AI context status once when lesson loads
  useEffect(() => {
    void (async () => {
      const ctxRes = await getAiContextStatusAction(lessonId);
      if (ctxRes.success && ctxRes.data) {
        setAiAvailable(true);
        if (!ctxRes.data.available && ctxRes.data.reason === 'NO_CONTEXT') {
          setAiUnavailableReason(ctxRes.data.reason);
        } else {
          setAiUnavailableReason(undefined);
        }
      } else {
        setAiAvailable(true);
        setAiUnavailableReason(undefined);
      }
    })();
  }, [lessonId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setQaExpanded(false);
      setQuizOpen(false);
      setQuizSessionId(null);
      setQuizQuestions([]);
      setQuizUnavailableReason(null);
      setChatOpen(false);
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const startLessonQuiz = async () => {
    if (quizLoading) return;
    setQuizOpen(true);
    setQuizLoading(true);
    setQuizUnavailableReason(null);

    const res = await generateQuizAction(courseId, lessonId, 'LESSON', 5);
    setQuizLoading(false);

    if (!res.success || !res.data) {
      const msg = res.message || '';
      const lowerMsg = msg.toLowerCase();
      if (msg.includes('100%')) setQuizUnavailableReason('COURSE_NOT_COMPLETED');
      else if (lowerMsg.includes('service') || lowerMsg.includes('không thể lấy')
        || lowerMsg.includes('tạm thời') || lowerMsg.includes('quota'))
        setQuizUnavailableReason('COURSE_SERVICE_UNAVAILABLE');
      else if (lowerMsg.includes('video')) setQuizUnavailableReason('VIDEO_TOO_LARGE');
      else setQuizUnavailableReason('INSUFFICIENT_CONTENT');
      return;
    }

    setQuizSessionId(res.data.sessionId);
    setQuizQuestions(res.data.questions);
    setQuizExpiresAt(res.data.expiresAt);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (certificateNumber && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#3b82f6'],
      });
    }
  }, [certificateNumber]);

  const handleComplete = (payload?: {
    courseCompleted?: boolean;
    certificateNumber?: string | null;
  }) => {
    if (payload?.courseCompleted) setCourseCompleted(true);
    if (payload?.certificateNumber) setCertificateNumber(payload.certificateNumber);
    void fetchData();
  };

  const handleToggleComplete = async () => {
    if (!lesson || togglingComplete) return;
    const newState = !lesson.progress?.isCompleted;
    setTogglingComplete(true);
    await updateLessonProgressAction(lesson.id, newState, lesson.progress?.lastWatched || 0);
    await fetchData();
    setTogglingComplete(false);
  };

  const lessonMeta = useMemo(() => {
    if (!data || !lesson) return { lessonNumber: 0, chapterTitle: '', chapterLessonDone: 0, chapterLessonTotal: 0 };
    const allLessons = data.chapters.flatMap((chapter) =>
      chapter.lessons.map((item) => ({ ...item, chapterTitle: chapter.title, chapterLessons: chapter.lessons })),
    );
    const index = allLessons.findIndex((item) => item.id === lesson.id);
    const current = index >= 0 ? allLessons[index] : null;
    const chapterLessonDone = current ? current.chapterLessons.filter((l) => l.progress?.isCompleted).length : 0;
    return {
      lessonNumber: index + 1,
      chapterTitle: current?.chapterTitle || '',
      chapterLessonDone,
      chapterLessonTotal: current?.chapterLessons.length || 0,
      prev: index > 0 ? allLessons[index - 1] : null,
      next: index < allLessons.length - 1 ? allLessons[index + 1] : null,
    };
  }, [data, lesson]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <BookOpen className="size-12 text-slate-300" />
        <p className="text-lg font-semibold text-slate-500">Bài học không tồn tại</p>
        <Link href="/dashboard/courses">
          <Button variant="outline" className="rounded-xl">Về khóa học của tôi</Button>
        </Link>
      </div>
    );
  }

  const hasVideo = !!lesson.videoUrl;
  const hasTextContent = lesson.contentType === 'TEXT' && lesson.content;
  const isCompleted = lesson.progress?.isCompleted || false;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Video / Content Area */}
      <div className="mx-auto max-w-5xl space-y-4 px-4 pt-4">
        {/* Meta Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 shadow-sm">
            <BookOpen className="size-3.5 text-slate-400" />
            Bài {lessonMeta.lessonNumber}/{data.totalLessons}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 shadow-sm">
            <ListChecks className="size-3.5 text-slate-400" />
            {lessonMeta.chapterTitle || 'Nội dung'}
          </span>
          {lesson.duration > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 shadow-sm">
              <Clock3 className="size-3.5 text-slate-400" />
              {formatDuration(lesson.duration)}
            </span>
          )}
          {lesson.isFree && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Miễn phí</span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3" />Đã xong
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-slate-800 leading-snug">{lesson.title}</h1>

        {/* Video */}
        {hasVideo ? (
          <VideoPlayer
            lessonId={lesson.id}
            videoUrl={lesson.videoUrl!}
            sourceType={lesson.sourceType}
            duration={lesson.duration}
            lastPosition={lesson.progress?.lastWatched || 0}
            isCompleted={isCompleted}
            onComplete={handleComplete}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <PlayCircle className="size-16 stroke-1" />
              <p className="text-sm font-medium">Video chưa được tải lên</p>
            </div>
          </div>
        )}

        {/* Text Content */}
        {hasTextContent && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-800">Nội dung bài học</h2>
            <div
              className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700"
              dangerouslySetInnerHTML={{ __html: lesson.content || '' }}
            />
          </div>
        )}

        {/* Quiz Button */}
        <QuizButton
          courseId={courseId}
          lessonId={lessonId}
          status={isCompleted ? 'AVAILABLE' : 'DISABLED'}
          reason={!isCompleted ? 'Hoàn thành bài học để mở khóa quiz.' : undefined}
          onStartQuiz={() => void startLessonQuiz()}
        />

        {/* Q&A Expandable */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setQaExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="size-5 text-primary" />
              <span className="text-sm font-semibold text-slate-700">Hỏi đáp về bài học này</span>
            </div>
            <span className={cn(
              'text-slate-400 transition-transform duration-200',
              qaExpanded ? 'rotate-180' : ''
            )}>
              <ChevronRight className="size-4" />
            </span>
          </button>
          {qaExpanded && (
            <div className="border-t border-slate-100 px-5 py-4">
              <CourseQaSection
                courseId={courseId}
                lessonId={lessonId}
                canAsk={true}
                showDashboardLink={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          {/* Prev */}
          {lessonMeta.prev ? (
            <Link href={`/learn/${courseId}/lesson/${lessonMeta.prev.id}`} data-nav="prev" className="min-w-0 flex-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-1.5 rounded-xl px-3 py-5 h-auto text-xs font-semibold"
              >
                <ChevronLeft className="size-4 shrink-0" />
                <span className="truncate">{lessonMeta.prev.title}</span>
              </Button>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {/* Action Icons */}
          <div className="flex items-center gap-2">
            {/* Complete Toggle */}
            <button
              type="button"
              onClick={handleToggleComplete}
              disabled={togglingComplete}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-[10px] font-semibold transition-all',
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600',
                togglingComplete && 'opacity-50',
              )}
            >
              {togglingComplete ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              <span>{isCompleted ? 'Đã xong' : 'Xong'}</span>
            </button>

            {/* QA Toggle */}
            <button
              type="button"
              onClick={() => setQaExpanded((v) => !v)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-[10px] font-semibold transition-all',
                qaExpanded
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
              )}
            >
              <HelpCircle className="size-4" />
              <span>Hỏi đáp</span>
            </button>

            {/* AI Chat Button — triggers floating ChatWidget */}
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-semibold text-slate-500 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              <MessageSquare className="size-4" />
              <span>AI Chat</span>
            </button>

            {/* Certificate */}
            {courseCompleted && (
              <Link href={certificateNumber ? `/certificates/${certificateNumber}` : '#'}>
                <button
                  type="button"
                  className="flex flex-col items-center gap-0.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] font-semibold text-amber-700 transition-all hover:bg-amber-100"
                >
                  <Award className="size-4" />
                  <span>Chứng chỉ</span>
                </button>
              </Link>
            )}
          </div>

          {/* Next */}
          {lessonMeta.next ? (
            <Link href={`/learn/${courseId}/lesson/${lessonMeta.next.id}`} data-nav="next" className="min-w-0 flex-1">
              <Button
                className="w-full justify-end gap-1.5 rounded-xl px-3 py-5 h-auto text-xs font-semibold shadow-md shadow-primary/20"
              >
                <span className="truncate">{lessonMeta.next.title}</span>
                <ChevronRight className="size-4 shrink-0" />
              </Button>
            </Link>
          ) : (
            <div className="flex-1 flex justify-end">
              {isCompleted && !lessonMeta.next && (
                <Link href="/dashboard/courses">
                  <Button className="rounded-xl px-4 py-5 h-auto text-xs font-semibold shadow-md shadow-primary/20">
                    Về danh sách
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-24 right-4 z-30 flex size-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-md hover:bg-slate-100 hover:text-slate-600 transition-colors border border-slate-200"
        title="Phím tắt (?)"
      >
        <Keyboard className="size-4" />
      </button>

      {/* Shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Phím tắt</h3>
              <button onClick={() => setShowShortcuts(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="size-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-4">
                <kbd className="rounded bg-slate-100 px-2.5 py-1 font-mono text-xs shadow-sm"><ChevronLeft className="size-3 inline" /></kbd>
                <span>Bài học trước</span>
              </div>
              <div className="flex items-center gap-4">
                <kbd className="rounded bg-slate-100 px-2.5 py-1 font-mono text-xs shadow-sm"><ChevronRight className="size-3 inline" /></kbd>
                <span>Bài học tiếp theo</span>
              </div>
              <div className="flex items-center gap-4">
                <kbd className="rounded bg-slate-100 px-2.5 py-1 font-mono text-xs shadow-sm">?</kbd>
                <span>Đóng hướng dẫn</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Widget — floating, opens on button click */}
      <ChatWidget
        courseId={courseId}
        lessonId={lessonId}
        aiAvailable={aiAvailable ?? true}
        aiUnavailableReason={aiUnavailableReason}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />

      {quizOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="h-[min(720px,90vh)] w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-xl">
            {quizLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Đang tạo quiz...</p>
              </div>
            ) : quizUnavailableReason ? (
              <div className="p-4">
                <QuizUnavailable reason={quizUnavailableReason} />
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={() => setQuizOpen(false)}>
                    Đóng
                  </Button>
                </div>
              </div>
            ) : quizSessionId ? (
              <QuizPanel
                courseId={courseId}
                lessonId={lessonId}
                quizType="LESSON"
                sessionId={quizSessionId}
                questions={quizQuestions}
                expiresAt={quizExpiresAt}
                onClose={() => setQuizOpen(false)}
                onSubmit={(answers) => submitQuizAction(quizSessionId, answers)}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
