'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, Clock, Loader2, PlayCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { getMyEnrollmentsAction } from '@/app/actions/student';
import type { MyCourseSummary } from '@/app/actions/learning';
import { useAppSelector } from '@/lib/redux/hooks';

type Filter = 'all' | 'in-progress' | 'completed';

function formatDate(value?: string | null) {
  if (!value) return 'Chưa học';
  return new Date(value).toLocaleDateString('vi-VN');
}

export default function MyCoursesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [items, setItems] = useState<MyCourseSummary[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    async function loadCourses() {
      const res = await getMyEnrollmentsAction();
      if (res.success && res.data) {
        setItems(res.data as MyCourseSummary[]);
        setError(null);
      } else {
        const message = res.message || 'Không thể tải danh sách khóa học.';
        setError(message);
        setItems([]);
        toast('error', 'Tải khóa học thất bại', message);
      }
    }
    void loadCourses();
  }, [isAuthenticated, isLoading, router]);

  const stats = useMemo(() => {
    const list = items ?? [];
    return {
      total: list.length,
      completed: list.filter((item) => (item.progressPercent ?? 0) >= 100).length,
      inProgress: list.filter((item) => (item.progressPercent ?? 0) < 100).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      const progress = item.progressPercent ?? 0;
      const matchesFilter =
        filter === 'all' || (filter === 'in-progress' && progress < 100) || (filter === 'completed' && progress >= 100);
      const matchesSearch = !query || item.title.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, items, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <BookOpen className="size-3.5" />
            Học tập
          </div>
          <h1 className="workspace-page-title">Khóa học của tôi</h1>
          <p className="workspace-page-description">
            Theo dõi trạng thái đang học, đã hoàn thành, tiến độ và lần học gần nhất của từng khóa.
          </p>
        </div>
        <Button asChild className="w-full rounded-xl font-bold md:w-auto">
          <Link href="/courses">Khám phá khóa học</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Tổng khóa học', value: stats.total, hint: 'Đã ghi danh' },
          { label: 'Đang học', value: stats.inProgress, hint: 'Chưa hoàn thành 100%' },
          { label: 'Hoàn thành', value: stats.completed, hint: 'Đủ điều kiện chứng chỉ' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{items === null ? '...' : stat.value.toLocaleString('vi-VN')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Danh sách khóa học</CardTitle>
            <CardDescription className="text-xs">Lọc theo trạng thái hoặc tìm nhanh theo tên khóa học.</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px] md:w-[520px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khóa học" className="rounded-xl pl-9" />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-medium"
              aria-label="Lọc khóa học theo tiến độ"
            >
              <option value="all">Tất cả</option>
              <option value="in-progress">Đang học</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          {items === null ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mb-4 size-10 animate-spin text-primary" />
              <p className="font-medium">Đang tải khóa học...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/40 py-14 text-center">
              <BookOpen className="mx-auto mb-4 size-12 text-muted-foreground/40" />
              <h3 className="text-lg font-bold">Bạn chưa có khóa học nào</h3>
              <p className="mx-auto mb-6 mt-1 max-w-md text-sm text-muted-foreground">
                Khám phá thư viện khóa học để bắt đầu lộ trình học tập của bạn.
              </p>
              <Button asChild className="rounded-xl font-bold">
                <Link href="/courses">Khám phá khóa học</Link>
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/40 py-12 text-center">
              <p className="text-sm font-semibold">Không tìm thấy khóa học phù hợp</p>
              <p className="mt-1 text-xs text-muted-foreground">Thử đổi từ khóa tìm kiếm hoặc bộ lọc tiến độ.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((item) => {
                const progress = item.progressPercent ?? 0;
                const isDone = progress >= 100;
                const href = `/learn/${item.id}`;
                return (
                  <Card key={item.id} className="overflow-hidden rounded-2xl border-white/60 bg-white/60 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80">
                    <CardContent className="space-y-4 p-5">
                      {item.thumbnail && (
                        <div className="-mx-5 -mt-5 h-36 overflow-hidden bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.thumbnail} alt={item.title} className="size-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-bold leading-tight">{item.title || 'Khóa học'}</h3>
                          <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <Clock className="size-3.5" />
                            {item.lastAccessedAt ? `Lần học gần nhất: ${formatDate(item.lastAccessedAt)}` : `Ghi danh: ${formatDate(item.enrolledAt)}`}
                          </p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'
                        }`}>
                          {isDone ? <CheckCircle2 className="size-3.5" /> : <PlayCircle className="size-3.5" />}
                          {isDone ? 'Đã hoàn thành' : 'Đang học'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                          <span>Tiến độ</span>
                          <span>{progress}% · {item.completedLessons}/{item.totalLessons} bài</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                          <div className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                      </div>
                      <Button asChild className="w-full gap-2 rounded-xl font-bold shadow-md">
                        <Link href={href}>
                          <PlayCircle className="size-4" />
                          {isDone ? 'Xem lại khóa học' : 'Tiếp tục học'}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
