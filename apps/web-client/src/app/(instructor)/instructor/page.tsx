'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  MessageSquare,
  PlusCircle,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import { getInstructorCoursesAction, type CourseDto } from '@/app/actions/instructor';

const STATUS_LABEL: Record<NonNullable<CourseDto['status']>, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã ẩn',
};

function formatDate(value?: string) {
  if (!value) return 'Chưa cập nhật';
  return new Date(value).toLocaleDateString('vi-VN');
}

export default function InstructorStudioHomePage() {
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      const result = await getInstructorCoursesAction();
      if (!result.success || !result.data) {
        setErrorMessage(result.message || 'Không tải được dữ liệu tổng quan từ API.');
        setCourses([]);
        setLoading(false);
        return;
      }

      setCourses(result.data);
      setErrorMessage('');
      setLoading(false);
    };

    void fetchCourses();
  }, []);

  const overviewStats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter((course) => course.status === 'PUBLISHED').length;
    const draft = courses.filter((course) => (course.status || 'DRAFT') === 'DRAFT').length;
    const totalEnrollments = courses.reduce((acc, course) => acc + (course._count?.enrollments || 0), 0);
    const readyToPublish = courses.filter((course) => Boolean(course.thumbnail) && Number(course.totalLessons || 0) > 0).length;

    return { total, published, draft, totalEnrollments, readyToPublish };
  }, [courses]);

  const recentCourses = useMemo(
    () =>
      [...courses]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 4),
    [courses],
  );

  return (
    <div className="workspace-page">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <BookOpen className="size-3.5" />
            Instructor Studio
          </div>
          <h1 className="workspace-page-title">Tổng quan giảng viên</h1>
          <p className="workspace-page-description">
            Theo dõi khóa học, học viên và các việc cần xử lý để kênh giảng dạy vận hành trơn tru.
          </p>
        </div>
        <Button asChild className="w-full rounded-xl font-bold shadow-md md:w-auto">
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng khóa học', value: overviewStats.total, hint: `${overviewStats.published} đã xuất bản · ${overviewStats.draft} bản nháp`, icon: BookOpen },
          { label: 'Học viên', value: overviewStats.totalEnrollments, hint: 'Tổng lượt ghi danh', icon: Users },
          { label: 'Sẵn sàng xuất bản', value: overviewStats.readyToPublish, hint: 'Có thumbnail và ít nhất 1 bài học', icon: CheckCircle2 },
          { label: 'Cần hoàn thiện', value: Math.max(overviewStats.total - overviewStats.readyToPublish, 0), hint: 'Thiếu nội dung hoặc ảnh đại diện', icon: CircleAlert },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <stat.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? '...' : stat.value.toLocaleString('vi-VN')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{loading ? 'Đang tải dữ liệu' : stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Khóa học cập nhật gần đây</CardTitle>
              <CardDescription className="text-xs">Vào wizard để hoàn thiện nội dung, preview và xuất bản.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="rounded-lg text-xs font-semibold">
              <Link href="/instructor/courses">
                Xem tất cả <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && (
              <div className="rounded-xl border border-dashed border-border bg-white/40 py-10 text-center text-sm text-muted-foreground">
                Đang tải danh sách khóa học...
              </div>
            )}
            {!loading && recentCourses.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-white/40 py-10 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold">Chưa có khóa học nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo khóa học đầu tiên để bắt đầu xây dựng nội dung.</p>
              </div>
            )}

            {recentCourses.map((course) => (
              <Link key={course.id} href={`/instructor/courses/${course.id}?step=1`} className="block">
                <div className="rounded-xl border border-slate-200/60 bg-white/60 p-4 transition-colors hover:border-primary/30 hover:bg-white/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{course.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {STATUS_LABEL[course.status || 'DRAFT']}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Cập nhật: {formatDate(course.updatedAt || course.createdAt)} · {course._count?.enrollments || 0} học viên · {course.totalLessons || 0} bài học
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flow xuất bản</CardTitle>
            <CardDescription className="text-xs">Đi theo thứ tự để tránh thiếu dữ liệu khi gửi khóa học ra công khai.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              'Thông tin cơ bản: tiêu đề, mô tả, danh mục, level, giá.',
              'Ảnh đại diện khóa học và chương trình học.',
              'Chapter, lesson và nội dung video/text cho từng bài.',
              'Preview trước khi bấm xuất bản.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed">{item}</p>
              </div>
            ))}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800">
                <CircleAlert className="size-3.5" /> Lưu ý trạng thái
              </div>
              <p className="mt-1 text-[11px] text-amber-700">Khóa ở bản nháp hoặc đã ẩn sẽ không hiển thị với học viên.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { href: '/instructor/qa', title: 'Trả lời Q&A', description: 'Xem câu hỏi của học viên theo khóa học.', icon: MessageSquare },
          { href: '/instructor/analytics', title: 'Xem doanh thu', description: 'Theo dõi đơn hàng và earning thực tế.', icon: TrendingUp },
          { href: '/instructor/settings', title: 'Rút tiền', description: 'Cập nhật ngân hàng và gửi payout.', icon: ArrowDownToLine },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <Card className="h-full rounded-2xl border-white/60 bg-white/50 backdrop-blur-md transition-colors hover:border-primary/30 hover:bg-white/80">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
