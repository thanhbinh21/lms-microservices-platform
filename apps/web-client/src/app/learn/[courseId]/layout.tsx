'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Menu, X, Loader2 } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';
import { Button } from '@/components/ui/button';
import { CurriculumSidebar } from '@/components/learning/curriculum-sidebar';
import { getLearnDataAction, enrollFreeAction, type LearnDataDto } from '@/app/actions/learning';
import { cn } from '@/lib/utils';

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((s) => s.auth);

  const [data, setData] = useState<LearnDataDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const res = await getLearnDataAction(courseId);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.message || 'Không thể tải dữ liệu khóa học');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, isAuthenticated, authLoading]);

  const handleEnrollFree = async () => {
    setEnrolling(true);
    const res = await enrollFreeAction(courseId);
    if (res.success) {
      await fetchData();
    }
    setEnrolling(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Đang tải bài học...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-center text-lg font-semibold text-slate-700">{error || 'Không tìm thấy khóa học'}</p>
        <Link href="/courses">
          <Button variant="outline">Quay lại danh sách khóa học</Button>
        </Link>
      </div>
    );
  }

  if (!data.enrolled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">{data.course.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Bạn cần ghi danh để bắt đầu học khóa này</p>
        </div>
        <Button
          onClick={handleEnrollFree}
          disabled={enrolling}
          className="gap-2 rounded-xl px-8 py-6 text-base font-bold shadow-lg shadow-primary/20"
        >
          {enrolling ? <Loader2 className="size-5 animate-spin" /> : null}
          Bắt đầu học miễn phí
        </Button>
        <Link href={`/courses/${data.course.slug}`} className="text-sm text-muted-foreground hover:text-primary">
          ← Xem chi tiết khóa học
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Sidebar (desktop) ───────────────────────────────────────────── */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-slate-800/40 bg-[#0c1425] text-slate-200 lg:flex">
        {/* Sidebar header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Link
            href={`/courses/${data.course.slug}`}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        </div>
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="line-clamp-2 text-sm font-bold leading-tight text-white">
            {data.course.title}
          </h2>
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

      {/* ── Mobile sidebar overlay ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[300px] bg-[#0c1425] text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="line-clamp-1 text-sm font-bold text-white">{data.course.title}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white hover:bg-white/10">
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
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Top bar */}
        <header className={cn(
          'sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5',
          'border-b border-slate-200/60 bg-white/70 backdrop-blur-xl',
        )}>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="hidden items-center gap-2 lg:flex">
            <Link href="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-primary">
              Dashboard
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
          </div>

          <h1 className="line-clamp-1 flex-1 text-sm font-semibold text-slate-700">
            {data.course.title}
          </h1>

          {/* Mini progress */}
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs font-bold text-emerald-600">{data.progressPercent}%</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${data.progressPercent}%` }}
              />
            </div>
          </div>
        </header>

        {/* Content slot */}
        <div className="flex-1 px-4 py-6 md:px-8 lg:px-12">
          {children}
        </div>
      </main>
    </div>
  );
}
