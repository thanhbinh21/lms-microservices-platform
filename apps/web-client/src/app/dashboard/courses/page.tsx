'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, BookOpen, PlayCircle, Clock, CheckCircle2 } from 'lucide-react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { useAppSelector } from '@/lib/redux/hooks';
import { getMyEnrollmentsAction } from '@/app/actions/student';

type Filter = 'all' | 'in-progress' | 'completed';

interface Enrollment {
  id: string;
  courseId: string;
  progress: number;
  enrolledAt: string;
  lastAccessedAt?: string | null;
  course?: {
    id: string;
    title: string;
    slug?: string;
    thumbnail?: string | null;
    totalLessons?: number;
    totalDuration?: number;
    instructorId?: string;
  };
}

export default function MyCoursesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [items, setItems] = useState<Enrollment[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    (async () => {
      const res = await getMyEnrollmentsAction();
      if (res.success && res.data) {
        setItems(res.data as Enrollment[]);
      } else {
        setError(res.message || 'Khong the tai danh sach khoa hoc.');
        setItems([]);
      }
    })();
  }, [isAuthenticated, isLoading, router]);

  const filtered = (items ?? []).filter((item) => {
    if (filter === 'in-progress') return (item.progress ?? 0) < 100;
    if (filter === 'completed') return (item.progress ?? 0) >= 100;
    return true;
  });

  const stats = {
    total: items?.length ?? 0,
    completed: items?.filter((i) => (i.progress ?? 0) >= 100).length ?? 0,
    inProgress: items?.filter((i) => (i.progress ?? 0) < 100).length ?? 0,
  };

  return (
    <div className="glass-page relative min-h-screen text-foreground overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-10 w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <SharedNavbar />
      <DashboardTabs />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-8 relative z-10">
        <ScrollReveal>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Khóa học của tôi</h1>
            <p className="text-sm font-medium text-muted-foreground">
              Tất cả khóa học bạn đã đăng ký — tiếp tục học hoặc xem tiến độ.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass-panel rounded-2xl border-white/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tổng</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            </Card>
            <Card className="glass-panel rounded-2xl border-white/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Đang học</p>
              <p className="mt-1 text-2xl font-bold text-primary">{stats.inProgress}</p>
            </Card>
            <Card className="glass-panel rounded-2xl border-white/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hoàn thành</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.completed}</p>
            </Card>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'in-progress', 'completed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                  filter === f
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white/60 text-muted-foreground hover:bg-white/90'
                }`}
              >
                {f === 'all' ? 'Tất cả' : f === 'in-progress' ? 'Đang học' : 'Đã hoàn thành'}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {items === null ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <Loader2 className="size-10 animate-spin text-primary mb-4" />
            <p className="font-medium text-muted-foreground">Đang tải khóa học...</p>
          </div>
        ) : error ? (
          <Card className="glass-panel rounded-2xl border-rose-200 bg-rose-50/60 p-6 text-sm text-rose-700">
            {error}
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="glass-panel border-dashed border-2 py-12 flex flex-col items-center justify-center text-center">
            <BookOpen className="size-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {filter === 'all'
                ? 'Bạn chưa có khóa học nào'
                : filter === 'completed'
                  ? 'Chưa có khóa học hoàn thành'
                  : 'Chưa có khóa học đang học'}
            </h3>
            <p className="text-muted-foreground text-sm font-medium max-w-sm mb-6">
              Khám phá thư viện khóa học để bắt đầu hành trình học tập của bạn.
            </p>
            <Link href="/courses">
              <Button className="px-8 font-bold shadow-md rounded-full">Khám phá khóa học</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((item, idx) => {
              const progress = item.progress ?? 0;
              const isDone = progress >= 100;
              const href = `/learn/${item.courseId}`;
              return (
                <ScrollReveal key={item.id} delay={idx * 80}>
                  <Card className="glass-panel rounded-2xl border-white/60 hover:shadow-lg transition-all p-5">
                    <CardContent className="p-0 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold leading-tight line-clamp-2">
                            {item.course?.title || 'Khóa học'}
                          </h3>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <Clock className="size-3.5" />
                            {item.lastAccessedAt
                              ? `Lần cuối: ${new Date(item.lastAccessedAt).toLocaleDateString('vi-VN')}`
                              : `Đăng ký: ${new Date(item.enrolledAt).toLocaleDateString('vi-VN')}`}
                          </p>
                        </div>
                        {isDone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            Hoàn thành
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                          <span>Tiến độ</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              isDone ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Link href={href} className="flex-1">
                          <Button className="w-full gap-2 rounded-xl font-bold shadow-md">
                            <PlayCircle className="size-4" />
                            {isDone ? 'Xem lại' : 'Tiếp tục học'}
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
