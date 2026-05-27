'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Menu, X } from 'lucide-react';
import { getCourseQuizStatusAction } from '@/app/actions/ai';
import { enrollFreeAction, getLearnDataAction, type LearnDataDto } from '@/app/actions/learning';
import { FinalQuizBanner } from '@/components/ai/quiz/final-quiz-banner';
import { CurriculumSidebar } from '@/components/learning/curriculum-sidebar';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';
import { cn } from '@/lib/utils';

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.auth);

  const [data, setData] = useState<LearnDataDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizStatus, setQuizStatus] = useState<{
    bestScore?: number;
    attemptCount?: number;
    serviceAvailable: boolean;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [learnDataResult, quizStatusResult] = await Promise.allSettled([
      getLearnDataAction(courseId),
      getCourseQuizStatusAction(courseId),
    ]);

    const learnData = learnDataResult.status === 'fulfilled' ? learnDataResult.value : null;
    if (learnData?.success && learnData.data) {
      setData(learnData.data);
    } else {
      setError(learnData?.message || 'Không thể tải dữ liệu khóa học.');
    }

    const quiz = quizStatusResult.status === 'fulfilled' ? quizStatusResult.value : null;
    setQuizStatus(
      quiz?.success && quiz.data
        ? { bestScore: quiz.data.bestScore, attemptCount: quiz.data.attemptCount, serviceAvailable: true }
        : { serviceAvailable: false },
    );

    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, fetchData, isAuthenticated, router]);

  useEffect(() => {
    const handleProgressUpdated = () => void fetchData();
    window.addEventListener('lms:learn-progress-updated', handleProgressUpdated);
    return () => window.removeEventListener('lms:learn-progress-updated', handleProgressUpdated);
  }, [fetchData]);

  const handleEnrollFree = async () => {
    setEnrolling(true);
    const result = await enrollFreeAction(courseId);
    if (result.success) await fetchData();
    else setError(result.message || 'Không thể ghi danh khóa học.');
    setEnrolling(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Đang tải không gian học tập...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <p className="text-lg font-semibold text-slate-700">{error || 'Không tìm thấy khóa học.'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void fetchData()}>Thử lại</Button>
          <Button asChild variant="ghost">
            <Link href="/courses">Quay lại danh sách khóa học</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data.enrolled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{data.course.title}</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground">Bạn cần ghi danh để bắt đầu học khóa này.</p>
        </div>
        <Button onClick={handleEnrollFree} disabled={enrolling} className="gap-2 rounded-xl px-8 py-6 text-base font-bold shadow-lg shadow-primary/20">
          {enrolling ? <Loader2 className="size-5 animate-spin" /> : null}
          Bắt đầu học miễn phí
        </Button>
        <Link href={`/courses/${data.course.slug}`} className="text-sm font-semibold text-muted-foreground hover:text-primary">
          Xem chi tiết khóa học
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-slate-800/40 bg-slate-950 text-slate-200 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
          <Link href={`/courses/${data.course.slug}`} className="flex items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="size-4" />
            Quay lại khóa học
          </Link>
        </div>
        <div className="border-b border-white/[0.08] px-4 py-3">
          <h2 className="line-clamp-2 text-sm font-bold leading-tight text-white">{data.course.title}</h2>
        </div>
        <CurriculumSidebar
          courseId={courseId}
          chapters={data.chapters}
          enrolled={data.enrolled}
          completedLessons={data.completedLessons}
          totalLessons={data.totalLessons}
          progressPercent={data.progressPercent}
        />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Đóng giáo trình" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(320px,90vw)] bg-slate-950 text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <h2 className="line-clamp-1 text-sm font-bold text-white">{data.course.title}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu giáo trình" className="text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </Button>
            </div>
            <CurriculumSidebar
              courseId={courseId}
              chapters={data.chapters}
              enrolled={data.enrolled}
              completedLessons={data.completedLessons}
              totalLessons={data.totalLessons}
              progressPercent={data.progressPercent}
            />
          </aside>
        </div>
      ) : null}

      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className={cn('sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-xl')}>
          <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Mở giáo trình">
            <Menu className="size-5" />
          </Button>
          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-primary">Dashboard</Link>
            <span className="text-xs text-muted-foreground">/</span>
          </div>
          <h1 className="line-clamp-1 flex-1 text-sm font-semibold text-slate-700">{data.course.title}</h1>
          <Link href={`/dashboard/qa?courseId=${courseId}`} className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10">
            Hỏi đáp
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs font-bold text-emerald-600">{data.progressPercent}%</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${data.progressPercent}%` }} />
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 py-6 md:px-8 lg:px-12">
          <div className="mb-4">
            <FinalQuizBanner
              courseId={courseId}
              progressPercent={data.progressPercent}
              quizBestScore={quizStatus?.bestScore}
              quizAttemptCount={quizStatus?.attemptCount}
              serviceAvailable={quizStatus?.serviceAvailable ?? false}
              onStartFinalQuiz={() => router.push(`/learn/${courseId}/quiz`)}
            />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
