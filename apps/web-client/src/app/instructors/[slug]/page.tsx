import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { BookOpen, ExternalLink, Facebook, Globe, Linkedin, Star, Twitter, UserCircle, Youtube } from 'lucide-react';
import { getInstructorBySlugAction } from '@/app/actions/instructor';
import { PublicCourseCard } from '@/components/shared/public-course-card';
import { PublicPageHeader, PublicPageShell, PublicState } from '@/components/shared/public-page';
import { Button } from '@/components/ui/button';

export default async function InstructorProfilePublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getInstructorBySlugAction(slug);

  if (!result.success || !result.data) notFound();

  const { profile, courseCount, averageRating, courses } = result.data;
  const socialIcons: Record<string, ReactNode> = {
    website: <Globe className="size-4" />,
    youtube: <Youtube className="size-4" />,
    facebook: <Facebook className="size-4" />,
    twitter: <Twitter className="size-4" />,
    linkedin: <Linkedin className="size-4" />,
  };
  const socialLabels: Record<string, string> = {
    website: 'Website',
    youtube: 'YouTube',
    facebook: 'Facebook',
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
  };

  return (
    <PublicPageShell mainClassName="max-w-6xl space-y-10 py-10">
      <section className="glass-panel rounded-2xl border-white/70 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="relative mx-auto size-32 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-sm md:mx-0 md:size-40">
            {profile.avatar ? (
              <Image src={profile.avatar} alt={profile.displayName} width={160} height={160} className="size-full object-cover" />
            ) : (
              <UserCircle className="size-full text-primary/30" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-center md:text-left">
            <PublicPageHeader
              eyebrow="Hồ sơ giảng viên"
              title={profile.displayName}
              description={profile.headline || 'Giảng viên tại NexEdu'}
              className="py-0"
            />

            <div className="mt-5 flex flex-wrap justify-center gap-3 md:justify-start">
              <div className="rounded-xl border border-white/70 bg-white/60 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-lg font-extrabold">
                  <BookOpen className="size-5 text-primary" />
                  {courseCount}
                </p>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Khóa học</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/60 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-lg font-extrabold text-amber-600">
                  <Star className="size-5 fill-current" />
                  {averageRating.toFixed(1)}
                </p>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Đánh giá</p>
              </div>
            </div>

            {profile.socialLinks && Object.values(profile.socialLinks).some(Boolean) ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
                {Object.entries(profile.socialLinks).map(([key, url]) => {
                  if (!url) return null;
                  return (
                    <a
                      key={key}
                      href={String(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
                    >
                      {socialIcons[key]} {socialLabels[key] || key}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {profile.bio ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Giới thiệu</h2>
          <div className="glass-panel rounded-2xl border-white/70 p-5">
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-muted-foreground">{profile.bio}</p>
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Khóa học nổi bật</h2>
            <p className="text-sm font-medium text-muted-foreground">Các chương trình đang được giảng viên này phụ trách.</p>
          </div>
          {courseCount > courses.length ? (
            <Button asChild variant="outline" className="rounded-xl bg-white/70">
              <Link href={`/courses?instructor=${profile.id}`}>
                Xem tất cả
                <ExternalLink className="ml-2 size-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        {courses.length === 0 ? (
          <PublicState
            icon={BookOpen}
            title="Giảng viên chưa có khóa học công khai"
            description="Các khóa học mới sẽ xuất hiện tại đây sau khi được xuất bản."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <PublicCourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </PublicPageShell>
  );
}
