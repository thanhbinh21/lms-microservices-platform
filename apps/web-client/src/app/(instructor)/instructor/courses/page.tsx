'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, MoreHorizontal, FileEdit, Eye, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getInstructorCoursesAction, type CourseDto } from '@/app/actions/instructor';

interface InstructorCourseView {
  id: string;
  title: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  price: number;
  enrollments: number;
  updatedAt: string;
}

export default function InstructorCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<InstructorCourseView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const result = await getInstructorCoursesAction();
      if (!result.success || !result.data) {
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
        updatedAt: course.updatedAt ? new Date(course.updatedAt).toLocaleDateString('vi-VN') : '-',
      }));

      setCourses(mapped);
      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Khóa học</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Tạo, chỉnh sửa và xuất bản khóa học của bạn.
          </p>
        </div>
        <Button onClick={() => router.push('/instructor/courses/create')} className="rounded-xl font-bold shadow-md md:w-auto w-full">
          <PlusCircle className="mr-2 size-4" />
          Tạo khóa học mới
        </Button>
      </div>

      {/* Course list */}
      <div className="space-y-3">
        {loading && (
          <div className="rounded-2xl border border-dashed border-border bg-white/30 py-16 text-center">
            <p className="text-sm text-muted-foreground">Đang tải danh sách khóa học...</p>
          </div>
        )}

        {!loading && courses.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-white/30 py-16 text-center">
            <BookOpen className="mx-auto mb-4 size-10 text-muted-foreground/40" />
            <h3 className="text-lg font-bold">Chưa có khóa học nào</h3>
            <p className="text-muted-foreground mt-1 mb-6 text-sm font-medium">
              Bắt đầu hành trình giảng dạy bằng cách tạo khóa học đầu tiên.
            </p>
            <Button onClick={() => router.push('/instructor/courses/create')} className="rounded-xl font-bold shadow-md">
              <PlusCircle className="mr-2 size-4" />
              Tạo khóa học mới
            </Button>
          </div>
        )}

        {!loading && courses.map((course) => (
          <Card
            key={course.id}
            className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm transition-shadow hover:shadow-md hover:bg-white/70"
          >
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base truncate">{course.title}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                    course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {course.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-medium">
                  <span>Giá: {course.price.toLocaleString('vi-VN')} đ</span>
                  <span>Học viên: {course.enrollments}</span>
                  <span>Cập nhật: {course.updatedAt}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-8" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}/detail`);
                }}>
                  <Eye className="mr-1.5 size-3.5" /> Chi tiết
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-8" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}?step=1`);
                }}>
                  <FileEdit className="mr-1.5 size-3.5" /> Cấu hình
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-8" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}?step=3`);
                }}>
                  Chương trình
                </Button>
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={(event) => event.stopPropagation()}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

