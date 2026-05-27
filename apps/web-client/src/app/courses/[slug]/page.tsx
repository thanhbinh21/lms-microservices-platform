import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Award, BookOpen, Clock3, Lock, MessageSquare, PlayCircle, UserCircle } from 'lucide-react';
import { getPublicCourseDetailAction } from '@/app/actions/instructor';
import { getCourseProgressAction } from '@/app/actions/student';
import { PublicCourseCard } from '@/components/shared/public-course-card';
import { PublicPageHeader, PublicPageShell, PublicState } from '@/components/shared/public-page';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnrollButton, CourseReviewPanel } from './enroll-button';

interface CourseDetailPageProps {
  params: Promise<{ slug: string }>;
}

function formatDuration(seconds?: number) {
  const total = Number(seconds || 0);
  if (!total) return 'Cập nhật';
  const minutes = Math.max(1, Math.ceil(total / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours}h ${remain}p` : `${hours}h`;
}

function levelLabel(level?: string | null) {
  if (level === 'BEGINNER') return 'Cơ bản';
  if (level === 'INTERMEDIATE') return 'Trung cấp';
  if (level === 'ADVANCED') return 'Nâng cao';
  return level || 'Cập nhật';
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = await params;
  const result = await getPublicCourseDetailAction(slug);

  if (!result.success || !result.data) notFound();

  const course = result.data;
  const totalLessons = course.chapters.reduce((acc, chapter) => acc + chapter.lessons.length, 0);
  const totalChapters = course.chapters.length;
  const instructorDisplayName = course.instructor?.displayName || `Giảng viên #${(course.instructorId || '').slice(0, 8)}`;
  const price = Number(course.price || 0);
  const formattedPrice = price > 0 ? `${price.toLocaleString('vi-VN')}đ` : 'Miễn phí';
  const dateSource = course.updatedAt || course.createdAt;
  const updatedLabel = dateSource
    ? new Date(dateSource).toLocaleDateString('vi-VN')
    : 'Cập nhật';

  const progressRes = await getCourseProgressAction(course.id);
  const isEnrolled = progressRes.success && progressRes.code === 200;
  const completedLessons =
    isEnrolled && Array.isArray(progressRes.data)
      ? progressRes.data.filter((item) => item?.isCompleted).length
      : 0;
  const isCourseCompleted = isEnrolled && totalLessons > 0 && completedLessons >= totalLessons;

  return (
    <PublicPageShell mainClassName="max-w-6xl space-y-8 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" />
          Quay lại danh sách khóa học
        </Link>
        <EnrollButton courseId={course.id} isEnrolled={isEnrolled} isFree={price === 0} price={price} />
      </div>

      <section className="glass-panel rounded-2xl border-white/70 p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <PublicPageHeader
              eyebrow="Chi tiết khóa học"
              title={course.title}
              description={course.description || 'Khóa học đang được giảng viên cập nhật nội dung chi tiết.'}
              className="py-0"
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{levelLabel(course.level)}</Badge>
              <Badge variant="secondary">{totalChapters} chương</Badge>
              <Badge variant="secondary">{totalLessons} bài học</Badge>
              {isEnrolled ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Đã ghi danh</Badge> : null}
            </div>
          </div>

          <Card className="rounded-2xl border-white/70 bg-white/60">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Giá khóa học</p>
                <p className="mt-1 text-3xl font-extrabold text-primary">{formattedPrice}</p>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <UserCircle className="size-4 text-primary" />
                  {course.instructor?.slug ? (
                    <Link href={`/instructors/${course.instructor.slug}`} className="text-primary hover:underline">
                      {instructorDisplayName}
                    </Link>
                  ) : (
                    instructorDisplayName
                  )}
                </div>
                <div className="flex items-center gap-2 font-semibold text-muted-foreground">
                  <Clock3 className="size-4" />
                  Cập nhật {updatedLabel}
                </div>
                <div className="flex items-center gap-2 font-semibold text-muted-foreground">
                  <Award className="size-4" />
                  Cấp chứng chỉ sau khi hoàn thành
                </div>
                <div className="flex items-center gap-2 font-semibold text-muted-foreground">
                  <MessageSquare className="size-4" />
                  Có Q&A theo khóa học
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Giáo trình khóa học</h2>
        {course.chapters.length === 0 ? (
          <PublicState
            icon={BookOpen}
            title="Khóa học chưa có chương công khai"
            description="Nội dung sẽ xuất hiện sau khi giảng viên xuất bản chương và bài học."
          />
        ) : (
          <div className="space-y-4">
            {course.chapters.map((chapter, chapterIndex) => (
              <Card key={chapter.id} className="glass-panel rounded-2xl border-white/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold">
                    Chương {chapterIndex + 1}: {chapter.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {chapter.lessons.length === 0 ? (
                    <p className="rounded-xl bg-white/60 px-3 py-3 text-sm font-medium text-muted-foreground">Chương này chưa có bài học công khai.</p>
                  ) : (
                    chapter.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 px-3 py-3">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold">{lesson.title}</p>
                          <p className="text-xs font-medium text-muted-foreground">{formatDuration(lesson.duration)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {lesson.isFree ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Học thử</Badge>
                          ) : null}
                          {isEnrolled ? <PlayCircle className="size-4 text-primary" /> : <Lock className="size-4 text-muted-foreground" />}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {Array.isArray(course.relatedCourses) && course.relatedCourses.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Khóa học liên quan</h2>
            <p className="text-sm font-medium text-muted-foreground">Gợi ý thêm theo cùng chủ đề hoặc giảng viên.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {course.relatedCourses.map((item) => (
              <PublicCourseCard key={item.id} course={item} />
            ))}
          </div>
        </section>
      ) : null}

      <CourseReviewPanel
        courseId={course.id}
        isEnrolled={isEnrolled}
        isCourseCompleted={isCourseCompleted}
        heading="Đánh giá và nhận xét"
      />
    </PublicPageShell>
  );
}
