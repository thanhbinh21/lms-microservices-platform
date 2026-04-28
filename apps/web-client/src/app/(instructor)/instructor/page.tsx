'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, BarChart3, Settings, ArrowRight, Sparkles, CheckCircle2, CircleAlert, Users, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import { getInstructorCoursesAction, type CourseDto } from '@/app/actions/instructor';

const quickLinks = [
  {
    title: 'Khóa học',
    description: 'Tạo mới, chỉnh sửa và xuất bản khóa học của bạn.',
    href: '/instructor/courses',
    icon: BookOpen,
  },
  {
    title: 'Nhóm cộng đồng',
    description: 'Quản lý nhóm cộng đồng cho học viên tham gia thảo luận.',
    href: '/instructor/communities',
    icon: Users,
  },
  {
    title: 'Mẫu chứng chỉ',
    description: 'Tạo và quản lý mẫu chứng chỉ cho học viên hoàn thành khóa học.',
    href: '/instructor/certificates',
    icon: Award,
  },
  {
    title: 'Phân tích & Doanh thu',
    description: 'Theo dõi lượt xem, đăng ký và doanh thu (dữ liệu mẫu).',
    href: '/instructor/analytics',
    icon: BarChart3,
  },
  {
    title: 'Thiết lập kênh',
    description: 'Thông tin kênh, thanh toán và hiển thị (trang mẫu).',
    href: '/instructor/settings',
    icon: Settings,
  },
];

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
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tổng quan</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
            Trung tâm quản lý nội dung và kênh giảng dạy. Mỗi khối bên dưới là một tab làm việc riêng để đi thẳng vào đúng khu vực.
          </p>
        </div>
        <Button asChild className="w-full shrink-0 rounded-xl font-bold shadow-md md:w-auto">
          <Link href="/instructor/courses/create">
            Tạo khóa học mới
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>

      {errorMessage && (
        <div className="mb-6">
          <StatusMessage type="error" message={errorMessage} />
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Tổng khóa học',
            value: loading ? '...' : String(overviewStats.total),
            hint: loading ? 'Đang tải dữ liệu' : `${overviewStats.published} đã xuất bản`,
          },
          {
            label: 'Học viên (enrollments)',
            value: loading ? '...' : overviewStats.totalEnrollments.toLocaleString('vi-VN'),
            hint: 'Tổng lượt ghi danh hiện có',
          },
          {
            label: 'Sẵn sàng publish',
            value: loading ? '...' : String(publishReadyCount),
            hint: `${overviewStats.draft} bản nháp cần hoàn thiện`,
          },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wide">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md lg:col-span-2">
          <CardHeader>
            <CardTitle>Khóa học cập nhật gần đây</CardTitle>
            <CardDescription>Nhấp để vào thẳng trang chi tiết khóa học.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && recentCourses.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có khóa học nào. Hãy tạo khóa học đầu tiên để bắt đầu.</p>
            )}

            {recentCourses.map((course) => (
              <Link key={course.id} href={`/instructor/courses/${course.id}?step=1`} className="block">
                <div className="rounded-xl border border-slate-200 bg-white/70 p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-800">{course.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {course.status || 'DRAFT'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Cập nhật: {new Date(course.updatedAt || course.createdAt).toLocaleString('vi-VN')} • {course._count?.enrollments || 0} học viên
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Checklist xuất bản</CardTitle>
            <CardDescription>Điều kiện tối thiểu trước khi bấm Xuất bản.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 text-primary" />
              <p>Có thumbnail và thông tin cơ bản (tiêu đề, mô tả, giá).</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 text-primary" />
              <p>Có ít nhất 1 chương và 1 bài học.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 text-primary" />
              <p>Có ít nhất 1 bài học đã Publish và có video URL.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <div className="flex items-center gap-2 font-bold">
                <CircleAlert className="size-4" /> Lưu ý
              </div>
              <p className="mt-1 text-xs">Nếu còn ở trạng thái DRAFT, học viên sẽ chưa thấy khóa học ở trang public.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Các tab điều hướng</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card className="h-full rounded-3xl border-white/60 bg-white/55 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <item.icon className="size-5" />
                </div>
                <div className="mb-2 inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Tab
                </div>
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <CardDescription className="text-sm font-medium leading-relaxed">{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center text-sm font-bold text-primary group-hover:underline">
                  Mở trang
                  <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
