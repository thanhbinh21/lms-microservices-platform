'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ArrowRight, Sparkles, CheckCircle2, CircleAlert, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import { getInstructorCoursesAction, type CourseDto } from '@/app/actions/instructor';

export default function InstructorStudioHomePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      const result = await getInstructorCoursesAction();
      if (!result.success || !result.data) {
        setErrorMessage(result.message || 'Không tải được dữ liệu tổng quan từ API.');
        setCourses([]);
        setLoading(false);
        return;
      }

      setCourses(result.data);
      setLoading(false);
    };

    void fetchCourses();
  }, []);

  const overviewStats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter((course) => course.status === 'PUBLISHED').length;
    const draft = courses.filter((course) => (course.status || 'DRAFT') === 'DRAFT').length;
    const totalEnrollments = courses.reduce((acc, course) => acc + (course._count?.enrollments || 0), 0);

    return { total, published, draft, totalEnrollments };
  }, [courses]);

  const recentCourses = useMemo(
    () => [...courses].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)).slice(0, 4),
    [courses],
  );

  const publishReadyCount = useMemo(
    () => courses.filter((course) => Boolean(course.thumbnail) && Number(course.totalLessons || 0) > 0).length,
    [courses],
  );

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tổng quan</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Theo dõi tình trạng kênh, khóa học và học viên của bạn.
          </p>
        </div>
        <Button asChild className="rounded-xl font-bold shadow-md md:w-auto w-full">
          <Link href="/instructor/courses/create">
            <PlusCircle className="mr-2 size-4" />
            Tạo khóa học mới
          </Link>
        </Button>
      </div>

      {errorMessage && (
        <div className="mb-6">
          <StatusMessage type="error" message={errorMessage} />
        </div>
      )}

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Tổng khóa học',
            value: loading ? '...' : String(overviewStats.total),
            hint: loading ? 'Đang tải' : `${overviewStats.published} đã xuất bản · ${overviewStats.draft} bản nháp`,
          },
          {
            label: 'Học viên',
            value: loading ? '...' : overviewStats.totalEnrollments.toLocaleString('vi-VN'),
            hint: 'Tổng lượt ghi danh',
          },
          {
            label: 'Sẵn sàng xuất bản',
            value: loading ? '...' : String(publishReadyCount),
            hint: 'Có thumbnail và bài học',
          },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content grid */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* Recent courses */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Khóa học cập nhật gần đây</CardTitle>
              <CardDescription className="text-xs">Nhấp để vào trang chi tiết.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="rounded-lg text-xs font-semibold">
              <Link href="/instructor/courses">
                Xem tất cả <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!loading && recentCourses.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-white/40 py-10 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Chưa có khóa học nào.</p>
                <p className="mt-1 text-xs text-muted-foreground">Hãy tạo khóa học đầu tiên để bắt đầu.</p>
              </div>
            )}

            {recentCourses.map((course) => (
              <Link key={course.id} href={`/instructor/courses/${course.id}?step=1`} className="block">
                <div className="rounded-xl border border-slate-200/60 bg-white/60 p-4 transition-colors hover:border-primary/30 hover:bg-white/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-sm truncate">{course.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {course.status || 'DRAFT'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Cập nhật: {new Date(course.updatedAt || course.createdAt).toLocaleDateString('vi-VN')} · {course._count?.enrollments || 0} học viên
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Publish checklist */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Checklist xuất bản</CardTitle>
            <CardDescription className="text-xs">Điều kiện tối thiểu trước khi bấm Xuất bản.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs">Thumbnail, tiêu đề, mô tả và giá đã được thiết lập.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs">Ít nhất 1 chương và 1 bài học.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs">Bài học đã có video/content.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800">
                <CircleAlert className="size-3.5" /> Lưu ý
              </div>
              <p className="mt-1 text-[11px] text-amber-700">Khóa ở trạng thái DRAFT sẽ không hiển thị với học viên.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
