'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardSkeleton } from '@/components/learning/dashboard-skeleton';
import type { MyCourseSummary } from '@/app/actions/learning';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

function calcStreak(courses: MyCourseSummary[]): number {
  if (courses.length === 0) return 0;
  const accessDates = courses
    .map((c) => {
      const d = new Date(c.lastAccessedAt || c.enrolledAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (accessDates.includes(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const fetchData = async () => {
      const res = await getDashboardData();
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    };
    void fetchData();
  }, [isAuthenticated, router]);

  const myCourses: MyCourseSummary[] = data?.myCourses || [];
  const streak = useMemo(() => calcStreak(myCourses), [myCourses]);

  const normalizedRole = (user?.role || '').toUpperCase();
  const canBecomeInstructor = isAuthenticated && normalizedRole === 'STUDENT';

  if (!user || loading) {
    return <DashboardSkeleton />;
  }

  const enrolledCount = myCourses.length;
  const completedCount = myCourses.filter((c) => c.progressPercent >= 100).length;
  const inProgressCount = enrolledCount - completedCount;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Xin chào, {user.name}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {enrolledCount === 0
              ? 'Bạn chưa ghi danh khóa học nào. Hãy bắt đầu khám phá!'
              : `Bạn đã học ${streak} ngày liên tiếp. Tiếp tục phát huy nhé!`}
          </p>
        </div>
        {canBecomeInstructor && (
          <Button onClick={() => router.push('/become-instructor')} className="rounded-xl font-bold shadow-sm">
            <Sparkles className="mr-2 size-4" />
            Trở thành giảng viên
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-transparent bg-white/70 p-4 shadow-sm">
          <div className="text-3xl font-extrabold text-primary">{enrolledCount}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">Khóa học đã ghi danh</div>
        </Card>
        <Card className="rounded-2xl border-transparent bg-white/70 p-4 shadow-sm">
          <div className="text-3xl font-extrabold text-emerald-600">{completedCount}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">Đã hoàn thành</div>
        </Card>
        <Card className="rounded-2xl border-transparent bg-white/70 p-4 shadow-sm">
          <div className="text-3xl font-extrabold text-amber-500">{inProgressCount}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">Đang học dở</div>
        </Card>
        <Card className="rounded-2xl border-transparent bg-white/70 p-4 shadow-sm">
          <div className="text-3xl font-extrabold text-orange-500">{streak}</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">Ngày học liên tiếp</div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Button
          variant="outline"
          className="h-auto flex-col gap-3 rounded-2xl border-transparent bg-white/70 p-5 text-left shadow-sm hover:bg-white/90"
          onClick={() => router.push('/dashboard/courses')}
        >
          <BookOpen className="size-8 text-primary" />
          <span className="font-bold">Khóa học của tôi</span>
          <span className="text-xs font-normal text-muted-foreground">Xem tiến độ học tập</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-3 rounded-2xl border-transparent bg-white/70 p-5 text-left shadow-sm hover:bg-white/90"
          onClick={() => router.push('/dashboard/certificates')}
        >
          <Award className="size-8 text-primary" />
          <span className="font-bold">Chứng chỉ</span>
          <span className="text-xs font-normal text-muted-foreground">Xem chứng chỉ đã nhận</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-3 rounded-2xl border-transparent bg-white/70 p-5 text-left shadow-sm hover:bg-white/90"
          onClick={() => router.push('/dashboard/qa')}
        >
          <MessageSquare className="size-8 text-primary" />
          <span className="font-bold">Hỏi đáp</span>
          <span className="text-xs font-normal text-muted-foreground">Đặt câu hỏi cho giảng viên</span>
        </Button>
      </div>

      {/* Continue learning */}
      {myCourses.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Tiếp tục học</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myCourses.slice(0, 3).map((course) => {
              const isCompleted = course.progressPercent >= 100;
              return (
                <button
                  key={course.id}
                  onClick={() => router.push(`/learn/${course.id}`)}
                  className="group rounded-2xl border border-transparent bg-white/70 p-4 text-left shadow-sm transition hover:bg-white/90 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="line-clamp-2 text-sm font-bold text-slate-800 group-hover:text-primary">
                      {course.title}
                    </div>
                    {isCompleted && <Award className="ml-2 size-5 shrink-0 text-emerald-500" />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span className={isCompleted ? 'text-emerald-600' : 'text-primary'}>{course.progressPercent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all"
                        style={{ width: `${course.progressPercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {course.completedLessons}/{course.totalLessons} bài hoàn thành
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {myCourses.length > 3 && (
            <Button
              variant="outline"
              className="w-full rounded-xl border-transparent bg-white/70 font-semibold shadow-sm"
              onClick={() => router.push('/dashboard/courses')}
            >
              Xem tất cả khóa học ({myCourses.length})
            </Button>
          )}
        </section>
      )}

      {myCourses.length === 0 && (
        <Card className="rounded-2xl border-transparent bg-white/70 p-8 text-center shadow-sm">
          <BookOpen className="mx-auto mb-3 size-10 text-slate-300" />
          <p className="font-bold text-slate-700">Bạn chưa ghi danh khóa học nào</p>
          <p className="mt-1 text-sm text-muted-foreground">Khám phá và đăng ký khóa học đầu tiên của bạn.</p>
          <Button className="mt-4 rounded-xl font-bold" onClick={() => router.push('/courses')}>
            Khám phá khóa học
          </Button>
        </Card>
      )}
    </div>
  );
}
