'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LearnChapterDto } from '@/app/actions/learning';

interface LessonNavigationProps {
  courseId: string;
  chapters: LearnChapterDto[];
  currentLessonId: string;
  enrolled: boolean;
}

function getAllLessons(chapters: LearnChapterDto[]) {
  return chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({ ...l, chapterTitle: ch.title })),
  );
}

export function LessonNavigation({
  courseId,
  chapters,
  currentLessonId,
  enrolled,
}: LessonNavigationProps) {
  const allLessons = getAllLessons(chapters);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const canAccessPrev = prev && (enrolled || prev.isFree);
  const canAccessNext = next && (enrolled || next.isFree);

  return (
    <div className="flex items-center justify-between gap-4">
      {canAccessPrev ? (
        <Link href={`/learn/${courseId}/lesson/${prev.id}`} className="min-w-0 flex-1">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-xl border-white/50 bg-white/40 px-4 py-5 backdrop-blur-sm hover:bg-white/60"
          >
            <ChevronLeft className="size-4 shrink-0" />
            <span className="truncate text-sm">{prev.title}</span>
          </Button>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {canAccessNext ? (
        <Link href={`/learn/${courseId}/lesson/${next.id}`} className="min-w-0 flex-1">
          <Button className="w-full justify-end gap-2 rounded-xl px-4 py-5 shadow-md shadow-primary/20">
            <span className="truncate text-sm">{next.title}</span>
            <ChevronRight className="size-4 shrink-0" />
          </Button>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
