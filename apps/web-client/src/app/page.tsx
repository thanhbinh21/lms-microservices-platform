import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, MessageSquare, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { getPublicCoursesAction } from '@/app/actions/instructor';
import { InstructorRequestFlash } from '@/components/home/InstructorRequestFlash';
import { HomeAuthActions } from '@/components/home/home-auth-actions';
import { PublicCourseCard } from '@/components/shared/public-course-card';
import { PublicPageShell } from '@/components/shared/public-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SITE_STATS } from '@/config/site-stats';

const highlights = [
  {
    title: 'Lộ trình rõ ràng',
    description: 'Khóa học được chia theo chương, bài học, tiến độ và bài kiểm tra cuối khóa.',
    icon: BookOpen,
  },
  {
    title: 'AI hỗ trợ học tập',
    description: 'AI Chat và quiz theo ngữ cảnh giúp học viên ôn tập ngay trong màn hình học.',
    icon: Sparkles,
  },
  {
    title: 'Cộng đồng thực chiến',
    description: 'Feed cộng đồng và Q&A theo khóa học giúp trao đổi với giảng viên và học viên khác.',
    icon: MessageSquare,
  },
];

export default async function Home() {
  const publicCoursesResult = await getPublicCoursesAction(1, 6);
  const featuredCourses = publicCoursesResult.success && publicCoursesResult.data
    ? publicCoursesResult.data.courses
    : [];

  return (
    <PublicPageShell mainClassName="space-y-16 py-10 md:py-14">
      <Suspense fallback={null}>
        <InstructorRequestFlash />
      </Suspense>

      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-7">
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            Nền tảng học tập thế hệ mới
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Học kỹ năng thực chiến cùng <span className="text-primary">NexEdu</span>
            </h1>
            <p className="max-w-2xl text-base font-medium leading-relaxed text-muted-foreground">
              Khám phá khóa học chất lượng, theo dõi tiến độ, hỏi đáp với giảng viên và dùng AI để ôn tập
              ngay trong từng bài học.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <HomeAuthActions context="hero" />
          </div>
          <div className="grid max-w-2xl grid-cols-3 gap-3">
            {[
              { value: SITE_STATS.totalCourses, label: 'Khóa học' },
              { value: SITE_STATS.totalStudentsNumber, label: 'Học viên' },
              { value: SITE_STATS.expertInstructors, label: 'Chuyên gia' },
            ].map((item) => (
              <div key={item.label} className="glass-panel rounded-2xl border-white/70 p-4 text-center">
                <p className="text-2xl font-extrabold text-primary">{item.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="glass-panel overflow-hidden rounded-2xl border-white/70">
          <CardContent className="p-6">
            <div className="rounded-2xl border border-white/70 bg-white/60 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">Không gian học tập</p>
                  <h2 className="mt-1 text-2xl font-bold">Curriculum, Q&A, AI Chat</h2>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <ShieldCheck className="size-6" />
                </div>
              </div>
              <div className="space-y-3">
                {['Theo dõi tiến độ từng bài', 'Tạo quiz theo bài học', 'Hỏi đáp và nhận hỗ trợ nhanh'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold">
                    <span className="size-2 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Khóa học nổi bật</p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">Bắt đầu với nội dung đã xuất bản</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
              Các khóa học được cập nhật theo lộ trình nghề nghiệp và đồng bộ với trải nghiệm học tập mới.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl bg-white/70 font-semibold">
            <Link href="/courses">
              Xem tất cả
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

        {featuredCourses.length === 0 ? (
          <Card className="glass-panel rounded-2xl border-white/70">
            <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
              Hiện chưa có khóa học công khai.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <PublicCourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title} className="glass-panel rounded-2xl border-white/70">
            <CardContent className="space-y-4 p-6">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="size-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="gradient-hero rounded-2xl p-6 text-white shadow-xl shadow-primary/20 md:p-10">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
              <Users className="size-4" />
              Cộng đồng NexEdu
            </p>
            <h2 className="mt-2 text-3xl font-bold">Sẵn sàng xây dựng lộ trình học của bạn?</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-white/85">
              Tham gia cùng {SITE_STATS.totalStudentsFull} học viên, học theo tiến độ cá nhân và nhận hỗ trợ từ cộng đồng.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <HomeAuthActions context="cta" />
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
