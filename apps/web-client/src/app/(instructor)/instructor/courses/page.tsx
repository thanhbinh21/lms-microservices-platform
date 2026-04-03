'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, MoreHorizontal, FileEdit, Eye } from 'lucide-react';
import { List, BookOpen } from 'lucide-react';
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Khóa học của tôi</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Quản lý nội dung, bài giảng và xuất bản khóa học.</p>
        </div>
        <Button 
          onClick={() => router.push('/instructor/courses/create')} 
          className="rounded-xl shadow-md font-bold px-6"
        >
          <PlusCircle className="mr-2 h-5 w-5" />
          Tạo khóa học mới
        </Button>
      </div>

      <div className="grid gap-4">
        {loading && (
          <div className="text-center py-16 text-muted-foreground">Đang tải danh sách khóa học...</div>
        )}

        {!loading && courses.map(course => (
          <Card
            key={course.id}
            className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/instructor/courses/${course.id}/detail`)}
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">{course.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {course.status}
                  </span>
                </div>
                <div className="flex gap-6 text-sm text-muted-foreground font-medium pt-1">
                  <span>Giá: {course.price.toLocaleString('vi-VN')} đ</span>
                  <span>Học viên: {course.enrollments}</span>
                  <span>Cập nhật: {course.updatedAt}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button variant="outline" size="sm" className="rounded-lg shadow-sm font-semibold" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}/detail`);
                }}>
                  <Eye className="w-4 h-4 mr-2" /> Chi tiết
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg shadow-sm font-semibold" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}`);
                }}>
                  <FileEdit className="w-4 h-4 mr-2" /> Cấu hình
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg shadow-sm font-semibold" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}/curriculum`);
                }}>
                  <List className="w-4 h-4 mr-2" /> Chương trình
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={(event) => event.stopPropagation()}>
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && courses.length === 0 && (
          <div className="text-center py-20 bg-white/40 rounded-3xl border border-dashed border-border">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-bold">Chưa có khóa học nào</h3>
            <p className="text-muted-foreground text-sm font-medium mt-1 mb-6">Bắt đầu hành trình giảng dạy của bạn bằng cách tạo khóa học đầu tiên.</p>
            <Button onClick={() => router.push('/instructor/courses/create')} className="rounded-xl shadow-md font-bold px-6">
              <PlusCircle className="mr-2 w-5 h-5" /> Tạo khóa học mới
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

