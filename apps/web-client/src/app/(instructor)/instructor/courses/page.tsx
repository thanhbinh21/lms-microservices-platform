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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      const result = await getInstructorCoursesAction();
      if (!result.success || !result.data) {
        setErrorMessage(result.message || 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch khÃ³a há»c.');
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
      setErrorMessage(null);
      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="workspace-page">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="workspace-page-title">KhÃ³a há»c</h1>
          <p className="workspace-page-description">
            Táº¡o, chá»‰nh sá»­a vÃ  xuáº¥t báº£n khÃ³a há»c cá»§a báº¡n.
          </p>
        </div>
        <Button onClick={() => router.push('/instructor/courses/create')} className="rounded-xl font-bold shadow-md md:w-auto w-full">
          <PlusCircle className="mr-2 size-4" />
          Táº¡o khÃ³a há»c má»›i
        </Button>
      </div>

      {/* Course list */}
      <div className="space-y-3">
        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {errorMessage}
          </div>
        )}
        {loading && (
          <div className="rounded-2xl border border-dashed border-border bg-white/30 py-16 text-center">
            <p className="text-sm text-muted-foreground">Äang táº£i danh sÃ¡ch khÃ³a há»c...</p>
          </div>
        )}

        {!loading && courses.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-white/30 py-16 text-center">
            <BookOpen className="mx-auto mb-4 size-10 text-muted-foreground/40" />
            <h3 className="text-lg font-bold">ChÆ°a cÃ³ khÃ³a há»c nÃ o</h3>
            <p className="text-muted-foreground mt-1 mb-6 text-sm font-medium">
              Báº¯t Ä‘áº§u hÃ nh trÃ¬nh giáº£ng dáº¡y báº±ng cÃ¡ch táº¡o khÃ³a há»c Ä‘áº§u tiÃªn.
            </p>
            <Button onClick={() => router.push('/instructor/courses/create')} className="rounded-xl font-bold shadow-md">
              <PlusCircle className="mr-2 size-4" />
              Táº¡o khÃ³a há»c má»›i
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
                  <span>GiÃ¡: {course.price.toLocaleString('vi-VN')} Ä‘</span>
                  <span>Há»c viÃªn: {course.enrollments}</span>
                  <span>Cáº­p nháº­t: {course.updatedAt}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-8" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}/detail`);
                }}>
                  <Eye className="mr-1.5 size-3.5" /> Chi tiáº¿t
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-8" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}?step=1`);
                }}>
                  <FileEdit className="mr-1.5 size-3.5" /> Cáº¥u hÃ¬nh
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs h-8" onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/instructor/courses/${course.id}?step=3`);
                }}>
                  ChÆ°Æ¡ng trÃ¬nh
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



