import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock3, PlayCircle, Lock } from 'lucide-react';
import { getPublicCourseDetailAction } from '@/app/actions/instructor';
import { getCourseProgressAction } from '@/app/actions/student';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

import { EnrollButton } from './enroll-button';


interface CourseDetailPageProps {
  params: Promise<{ slug: string }>;
}

function formatDuration(seconds?: number) {
  const total = Number(seconds || 0);
  if (!total) return '0 phút';
  const mins = Math.max(1, Math.ceil(total / 60));
  return `${mins} phút`;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = await params;
  const result = await getPublicCourseDetailAction(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  const course = result.data;
  const totalLessons = course.chapters.reduce((acc, chapter) => acc + chapter.lessons.length, 0);
  const totalChapters = course.chapters.length;
  const instructorDisplayName = `Giảng viên #${(course.instructorId || '').slice(0, 8)}`;
  const formattedPrice = `${Number(course.price || 0).toLocaleString('vi-VN')}đ`;
  const updatedLabel = course.updatedAt || course.createdAt
    ? new Date(course.updatedAt || course.createdAt || Date.now()).toLocaleDateString('vi-VN')
    : '-';

  const isFree = Number(course.price) === 0;

  // Kiem tra enrollment bang cach get progress
  const progressRes = await getCourseProgressAction(course.id);
  const isEnrolled = progressRes.success && progressRes.code === 200;

  return (
    <div className="glass-page min-h-screen text-foreground relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[35%] h-[40%] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[25%] left-[-10%] w-[30%] h-[35%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 space-y-8 relative z-10">
        <div className="flex items-center justify-between">
          <Link href="/courses" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            ← Quay lại danh sách khóa học
          </Link>
          <EnrollButton
            courseId={course.id}
            isEnrolled={isEnrolled}
            isFree={isFree}
            price={Number(course.price || 0)}
          />
        </div>

        <Card className="rounded-3xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
          <CardHeader className="space-y-4">
            <div className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Chi tiết khóa học</div>
            <CardTitle className="text-3xl font-bold tracking-tight">{course.title}</CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {course.description || 'Khóa học đang được cập nhật nội dung chi tiết. Bạn có thể xem trước các bài học miễn phí bên dưới.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                <Clock3 className="size-3.5" /> {totalLessons} bài học
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                Trạng thái: {course.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Giảng viên</p>
              <p className="mt-1 font-bold text-slate-800">{instructorDisplayName}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cấp độ</p>
              <p className="mt-1 font-bold text-slate-800">{course.level}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Giá khóa học</p>
              <p className="mt-1 font-bold text-primary">{formattedPrice}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số chương</p>
              <p className="mt-1 font-bold text-slate-800">{totalChapters}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng bài học</p>
              <p className="mt-1 font-bold text-slate-800">{totalLessons}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cập nhật</p>
              <p className="mt-1 font-bold text-slate-800">{updatedLabel}</p>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Giáo trình khóa học</h2>
          <div className="space-y-4">
            {course.chapters.length === 0 && (
              <Card className="rounded-2xl border-white/60 bg-white/70">
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Khóa học chưa có chương nào được xuất bản.
                </CardContent>
              </Card>
            )}

            {course.chapters.map((chapter) => (
              <Card key={chapter.id} className="rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">{chapter.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {chapter.lessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDuration(lesson.duration)}</p>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        {!isEnrolled && (
                          <span className="text-[10px] font-bold rounded-full px-2 py-0.5 inline-flex items-center gap-1 bg-slate-100 text-slate-500">
                            <Lock className="size-3" /> Yêu cầu đăng ký
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
