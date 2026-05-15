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
        setErrorMessage(result.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u tá»•ng quan tá»« API.');
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
    () =>
      [...courses]
        .filter((c) => c.updatedAt || c.createdAt)
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 4),
    [courses],
  );

  const publishReadyCount = useMemo(
    () => courses.filter((course) => Boolean(course.thumbnail) && Number(course.totalLessons || 0) > 0).length,
    [courses],
  );

  return (
    <div className="workspace-page">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="workspace-page-title">Tá»•ng quan</h1>
          <p className="workspace-page-description">
            Theo dÃµi tÃ¬nh tráº¡ng kÃªnh, khÃ³a há»c vÃ  há»c viÃªn cá»§a báº¡n.
          </p>
        </div>
        <Button asChild className="rounded-xl font-bold shadow-md md:w-auto w-full">
          <Link href="/instructor/courses/create">
            <PlusCircle className="mr-2 size-4" />
            Táº¡o khÃ³a há»c má»›i
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
            label: 'Tá»•ng khÃ³a há»c',
            value: loading ? '...' : String(overviewStats.total),
            hint: loading ? 'Äang táº£i' : `${overviewStats.published} Ä‘Ã£ xuáº¥t báº£n Â· ${overviewStats.draft} báº£n nhÃ¡p`,
          },
          {
            label: 'Há»c viÃªn',
            value: loading ? '...' : overviewStats.totalEnrollments.toLocaleString('vi-VN'),
            hint: 'Tá»•ng lÆ°á»£t ghi danh',
          },
          {
            label: 'Sáºµn sÃ ng xuáº¥t báº£n',
            value: loading ? '...' : String(publishReadyCount),
            hint: 'CÃ³ thumbnail vÃ  bÃ i há»c',
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
              <CardTitle className="text-base">KhÃ³a há»c cáº­p nháº­t gáº§n Ä‘Ã¢y</CardTitle>
              <CardDescription className="text-xs">Nháº¥p Ä‘á»ƒ vÃ o trang chi tiáº¿t.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="rounded-lg text-xs font-semibold">
              <Link href="/instructor/courses">
                Xem táº¥t cáº£ <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!loading && recentCourses.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-white/40 py-10 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">ChÆ°a cÃ³ khÃ³a há»c nÃ o.</p>
                <p className="mt-1 text-xs text-muted-foreground">HÃ£y táº¡o khÃ³a há»c Ä‘áº§u tiÃªn Ä‘á»ƒ báº¯t Ä‘áº§u.</p>
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
                    Cáº­p nháº­t: {(course.updatedAt ? new Date(course.updatedAt) : course.createdAt ? new Date(course.createdAt) : null)?.toLocaleDateString('vi-VN') || 'â€”'} Â· {course._count?.enrollments || 0} há»c viÃªn
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Publish checklist */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Checklist xuáº¥t báº£n</CardTitle>
            <CardDescription className="text-xs">Äiá»u kiá»‡n tá»‘i thiá»ƒu trÆ°á»›c khi báº¥m Xuáº¥t báº£n.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs">Thumbnail, tiÃªu Ä‘á», mÃ´ táº£ vÃ  giÃ¡ Ä‘Ã£ Ä‘Æ°á»£c thiáº¿t láº­p.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs">Ãt nháº¥t 1 chÆ°Æ¡ng vÃ  1 bÃ i há»c.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs">BÃ i há»c Ä‘Ã£ cÃ³ video/content.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800">
                <CircleAlert className="size-3.5" /> LÆ°u Ã½
              </div>
              <p className="mt-1 text-[11px] text-amber-700">KhÃ³a á»Ÿ tráº¡ng thÃ¡i DRAFT sáº½ khÃ´ng hiá»ƒn thá»‹ vá»›i há»c viÃªn.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


