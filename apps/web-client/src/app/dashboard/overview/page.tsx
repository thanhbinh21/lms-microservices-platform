'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, BookOpen, Clock3, Loader2, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import { getDashboardData } from '@/app/actions/dashboard';
import type { MyCourseSummary } from '@/app/actions/learning';
import { DashboardSkeleton } from '@/components/learning/dashboard-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useAppSelector } from '@/lib/redux/hooks';

type DashboardPayload = Awaited<ReturnType<typeof getDashboardData>>['data'];

function calcStreak(courses: MyCourseSummary[]): number {
  if (courses.length === 0) return 0;
  const accessDates = courses
    .map((course) => {
      const date = new Date(course.lastAccessedAt || course.enrolledAt);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    })
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort()
    .reverse();

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (accessDates.includes(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function formatLastAccess(course: MyCourseSummary) {
  const value = course.lastAccessedAt || course.enrolledAt;
  return new Date(value).toLocaleDateString('vi-VN');
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      const res = await getDashboardData();
      if (res.success && res.data) {
        setData(res.data);
        setErrorMessage('');
      } else {
        const message = 'Không thể tải dữ liệu dashboard. Vui lòng thử lại.';
        setErrorMessage(message);
        toast('error', 'Tải dashboard thất bại', message);
      }
      setLoading(false);
    };
    void fetchData();
  }, [isAuthenticated, router]);

  const myCourses: MyCourseSummary[] = data?.myCourses || [];
  const streak = useMemo(() => calcStreak(myCourses), [myCourses]);

  if (!user || loading) {
    return <DashboardSkeleton />;
  }

  const enrolledCount = myCourses.length;
  const completedCount = myCourses.filter((course) => course.progressPercent >= 100).length;
  const inProgressCount = enrolledCount - completedCount;
  const nextCourses = [...myCourses]
    .sort((a, b) => new Date(b.lastAccessedAt || b.enrolledAt).getTime() - new Date(a.lastAccessedAt || a.enrolledAt).getTime())
    .slice(0, 3);
  const canBecomeInstructor = isAuthenticated && (user.role || '').toUpperCase() === 'STUDENT';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <TrendingUp className="size-3.5" />
            Dashboard học viên
          </div>
          <h1 className="workspace-page-title">Xin chào, {user.name}</h1>
          <p className="workspace-page-description">
            Theo dõi tiến độ học tập, tiếp tục khóa học gần đây và truy cập nhanh các tác vụ quan trọng.
          </p>
        </div>
        {canBecomeInstructor && (
          <Button onClick={() => router.push('/become-instructor')} className="w-full rounded-xl font-bold shadow-sm md:w-auto">
            <Sparkles className="mr-2 size-4" />
            Trở thành giảng viên
          </Button>
        )}
      </div>

      {errorMessage && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">{errorMessage}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Đã ghi danh', value: enrolledCount, hint: 'Tổng khóa học của bạn', icon: BookOpen },
          { label: 'Đang học', value: inProgressCount, hint: 'Chưa hoàn thành 100%', icon: Clock3 },
          { label: 'Hoàn thành', value: completedCount, hint: 'Đủ điều kiện nhận chứng chỉ', icon: Award },
          { label: 'Chuỗi học', value: streak, hint: 'Ngày học liên tiếp gần đây', icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <stat.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-2xl font-bold">{stat.value.toLocaleString('vi-VN')}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Khóa học của tôi', description: 'Xem tiến độ và tiếp tục học', href: '/dashboard/courses', icon: BookOpen },
          { title: 'Chứng chỉ', description: 'Xem chứng chỉ đã nhận', href: '/dashboard/certificates', icon: Award },
          { title: 'Hỏi đáp', description: 'Đặt câu hỏi theo khóa học', href: '/dashboard/qa', icon: MessageSquare },
        ].map((item) => (
          <button
            key={item.href}
            type="button"
            className="rounded-2xl border border-white/60 bg-white/50 p-5 text-left shadow-sm backdrop-blur-md transition-colors hover:border-primary/30 hover:bg-white/80"
            onClick={() => router.push(item.href)}
          >
            <item.icon className="mb-3 size-8 text-primary" />
            <p className="font-bold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Tiếp tục học</CardTitle>
            <CardDescription className="text-xs">Các khóa học được sắp xếp theo lần học gần nhất.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-semibold" onClick={() => router.push('/dashboard/courses')}>
            Xem tất cả
          </Button>
        </CardHeader>
        <CardContent>
          {nextCourses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white/40 py-12 text-center">
              <BookOpen className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-semibold">Bạn chưa ghi danh khóa học nào</p>
              <p className="mt-1 text-xs text-muted-foreground">Khám phá thư viện khóa học để bắt đầu lộ trình học tập.</p>
              <Button className="mt-4 rounded-xl font-bold" onClick={() => router.push('/courses')}>Khám phá khóa học</Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {nextCourses.map((course) => {
                const isCompleted = course.progressPercent >= 100;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => router.push(`/learn/${course.id}`)}
                    className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 text-left transition-colors hover:border-primary/30 hover:bg-white/80"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-bold">{course.title}</p>
                      {isCompleted && <Award className="size-5 shrink-0 text-emerald-500" />}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Tiến độ</span>
                        <span className={isCompleted ? 'text-emerald-600' : 'text-primary'}>{course.progressPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, course.progressPercent)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {course.completedLessons}/{course.totalLessons} bài · Lần học gần nhất: {formatLastAccess(course)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
