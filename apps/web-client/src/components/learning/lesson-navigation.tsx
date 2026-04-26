'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Award, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LearnChapterDto } from '@/app/actions/learning';

interface LessonNavigationProps {
  courseId: string;
  courseSlug?: string;
  chapters: LearnChapterDto[];
  currentLessonId: string;
  enrolled: boolean;
  currentLessonCompleted?: boolean;
  courseCompleted?: boolean;
  certificateNumber?: string | null;
}

function getAllLessons(chapters: LearnChapterDto[]) {
  return chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({ ...l, chapterTitle: ch.title })),
  );
}

export function LessonNavigation({
  courseId,
  courseSlug,
  chapters,
  currentLessonId,
  enrolled,
  currentLessonCompleted = false,
  courseCompleted = false,
  certificateNumber = null,
}: LessonNavigationProps) {
  const allLessons = getAllLessons(chapters);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const canAccessPrev = prev && (enrolled || prev.isFree);
  const canAccessNext = next && (enrolled || next.isFree);
  const isLastLesson = currentIndex === allLessons.length - 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {canAccessPrev ? (
          <Link href={`/learn/${courseId}/lesson/${prev.id}`} className="min-w-0">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-white/50 bg-white/40 px-4 py-5 backdrop-blur-sm hover:bg-white/60"
            >
              <ChevronLeft className="size-4 shrink-0" />
              <span className="truncate text-sm">{prev.title}</span>
            </Button>
          </Link>
        ) : (
          <div aria-hidden className="min-h-12 rounded-xl border border-transparent" />
        )}

        {canAccessNext ? (
          <Link href={`/learn/${courseId}/lesson/${next.id}`} className="min-w-0">
            <Button className="w-full justify-end gap-2 rounded-xl px-4 py-5 shadow-md shadow-primary/20">
              <span className="truncate text-sm">{next.title}</span>
              <ChevronRight className="size-4 shrink-0" />
            </Button>
          </Link>
        ) : (
          <div aria-hidden className="min-h-12 rounded-xl border border-transparent" />
        )}
      </div>

      {isLastLesson && currentLessonCompleted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <div className="mb-3 flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-700">
                Ban da hoan thanh bai hoc cuoi.
              </p>
              <p className="text-xs text-emerald-700/80">
                {courseCompleted
                  ? 'Khoa hoc da hoan thanh. Tiep theo: nhan chung chi va danh gia khoa hoc.'
                  : 'Hay kiem tra cac bai truoc de dam bao tien do khoa hoc dat 100%.'}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {courseCompleted ? (
              <Link href="/dashboard/certificates">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 border-emerald-300/80 bg-white"
                >
                  <Award className="size-4" />
                  Xem chung chi
                </Button>
              </Link>
            ) : (
              <Button disabled className="w-full justify-center gap-2">
                <Award className="size-4" />
                Chua du dieu kien
              </Button>
            )}

            <Link href={courseSlug ? `/courses/${courseSlug}` : `/courses`}>
              <Button variant="outline" className="w-full justify-center gap-2 bg-white">
                <Star className="size-4" />
                Danh gia khoa hoc
              </Button>
            </Link>

            <Link href="/dashboard/courses">
              <Button className="w-full justify-center">Ve dashboard</Button>
            </Link>
          </div>

          {certificateNumber && (
            <p className="mt-2 text-[11px] font-semibold text-emerald-700/90">
              Ma chung chi: {certificateNumber}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
