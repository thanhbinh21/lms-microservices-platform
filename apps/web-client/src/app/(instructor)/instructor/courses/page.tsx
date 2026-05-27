'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Eye, FileEdit, PlusCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getInstructorCoursesAction, type CourseDto } from '@/app/actions/instructor';

interface InstructorCourseView {
  id: string;
  title: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  price: number;
  enrollments: number;
  lessons: number;
  updatedAt: string;
  hasThumbnail: boolean;
}

const STATUS_LABEL: Record<InstructorCourseView['status'], string> = {
  PUBLISHED: 'Đã xuất bản',
  DRAFT: 'Bản nháp',
  ARCHIVED: 'Đã ẩn',
};

const STATUS_CLASS: Record<InstructorCourseView['status'], string> = {
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  DRAFT: 'bg-slate-200 text-slate-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

export default function InstructorCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<InstructorCourseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InstructorCourseView['status']>('ALL');

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      const result = await getInstructorCoursesAction();
      if (!result.success || !result.data) {
        setErrorMessage(result.message || 'Không thể tải danh sách khóa học.');
        setCourses([]);
        setLoading(false);
        return;
      }

      const mapped = result.data.map((course: CourseDto) => ({
        id: course.id,
        title: course.title,
        status: course.status || 'DRAFT',
        price: Number(course.price),
        enrollments: course._count?.enrollments ?? 0,
        lessons: Number(course.totalLessons || 0),
        hasThumbnail: Boolean(course.thumbnail),
        updatedAt: course.updatedAt ? new Date(course.updatedAt).toLocaleDateString('vi-VN') : '-',
      }));

      setCourses(mapped);
      setErrorMessage(null);
      setLoading(false);
    };

    void fetchCourses();
  }, []);

  const stats = useMemo(() => {
    const published = courses.filter((course) => course.status === 'PUBLISHED').length;
    const draft = courses.filter((course) => course.status === 'DRAFT').length;
    const totalEnrollments = courses.reduce((sum, course) => sum + course.enrollments, 0);
    return { published, draft, totalEnrollments };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || course.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [courses, search, statusFilter]);

  return (
    <div className="workspace-page">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <BookOpen className="size-3.5" />
            Nội dung khóa học
          </div>
          <h1 className="workspace-page-title">Khóa học của tôi</h1>
          <p className="workspace-page-description">
            Tạo khóa học, quản lý chương trình học, preview và xuất bản nội dung cho học viên.
          </p>
        </div>
        <Button onClick={() => router.push('/instructor/courses/create')} className="w-full rounded-xl font-bold shadow-md md:w-auto">
          <PlusCircle className="mr-2 size-4" />
          Tạo khóa học mới
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Đã xuất bản', value: stats.published, hint: 'Đang bán hoặc hiển thị công khai' },
          { label: 'Bản nháp', value: stats.draft, hint: 'Cần hoàn thiện trước khi publish' },
          { label: 'Học viên', value: stats.totalEnrollments, hint: 'Tổng lượt ghi danh' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{loading ? '...' : stat.value.toLocaleString('vi-VN')}</CardTitle>
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
            <CardDescription className="text-xs">Lọc nhanh theo tên hoặc trạng thái để tiếp tục chỉnh sửa.</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px] md:w-[520px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khóa học" className="rounded-xl pl-9" />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-medium"
              aria-label="Lọc trạng thái khóa học"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đã xuất bản</option>
              <option value="ARCHIVED">Đã ẩn</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          )}
          {loading && (
            <div className="rounded-2xl border border-dashed border-border bg-white/30 py-16 text-center">
              <p className="text-sm text-muted-foreground">Đang tải danh sách khóa học...</p>
            </div>
          )}

          {!loading && courses.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-white/30 py-16 text-center">
              <BookOpen className="mx-auto mb-4 size-10 text-muted-foreground/40" />
              <h3 className="text-lg font-bold">Chưa có khóa học nào</h3>
              <p className="mx-auto mb-6 mt-1 max-w-md text-sm font-medium text-muted-foreground">
                Bắt đầu bằng bản nháp đầu tiên, sau đó thêm chapter, lesson, video/text content và preview trước khi publish.
              </p>
              <Button onClick={() => router.push('/instructor/courses/create')} className="rounded-xl font-bold shadow-md">
                <PlusCircle className="mr-2 size-4" />
                Tạo khóa học mới
              </Button>
            </div>
          )}

          {!loading && courses.length > 0 && filteredCourses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-white/30 py-12 text-center">
              <p className="text-sm font-semibold">Không tìm thấy khóa học phù hợp</p>
              <p className="mt-1 text-xs text-muted-foreground">Thử đổi từ khóa tìm kiếm hoặc trạng thái lọc.</p>
            </div>
          )}

          {!loading && filteredCourses.map((course) => (
            <div
              key={course.id}
              className="rounded-2xl border border-white/60 bg-white/50 p-5 shadow-sm backdrop-blur-md transition-colors hover:bg-white/70"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-bold">{course.title}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASS[course.status]}`}>
                      {STATUS_LABEL[course.status]}
                    </span>
                    {!course.hasThumbnail && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">Thiếu thumbnail</span>
                    )}
                    {course.lessons === 0 && (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">Chưa có bài học</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
                    <span>Giá: {course.price.toLocaleString('vi-VN')} đ</span>
                    <span>Học viên: {course.enrollments}</span>
                    <span>Bài học: {course.lessons}</span>
                    <span>Cập nhật: {course.updatedAt}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-semibold" onClick={() => router.push(`/instructor/courses/${course.id}/detail`)}>
                    <Eye className="mr-1.5 size-3.5" /> Preview
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-semibold" onClick={() => router.push(`/instructor/courses/${course.id}?step=1`)}>
                    <FileEdit className="mr-1.5 size-3.5" /> Thông tin
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-semibold" onClick={() => router.push(`/instructor/courses/${course.id}?step=3`)}>
                    Chương trình
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
