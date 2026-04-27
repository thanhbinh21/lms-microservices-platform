'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronDown, CheckCircle2, PlayCircle, Lock, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LearnChapterDto } from '@/app/actions/learning';

function formatDuration(seconds: number) {
  if (!seconds) return '';
  const mins = Math.ceil(seconds / 60);
  return `${mins} ph`;
}

interface CurriculumSidebarProps {
  courseId: string;
  chapters: LearnChapterDto[];
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  discussionGroupId?: string | null;
}

export function CurriculumSidebar({
  courseId,
  chapters,
  enrolled,
  completedLessons,
  totalLessons,
  progressPercent,
  discussionGroupId,
}: CurriculumSidebarProps) {
  const params = useParams();
  const currentLessonId = params.lessonId as string | undefined;
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () => {
      const set = new Set<string>();
      for (const ch of chapters) {
        if (ch.lessons.some((l) => l.id === currentLessonId)) {
          set.add(ch.id);
        }
      }
      if (set.size === 0 && chapters.length > 0) {
        set.add(chapters[0].id);
      }
      return set;
    },
  );

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Progress summary */}
      <div className="border-b border-white/20 p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-300">
          <span>{completedLessons}/{totalLessons} bài hoàn thành</span>
          <span className="text-emerald-400">{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {discussionGroupId ? (
        <div className="border-b border-white/[0.08] px-4 py-3">
          <Link
            href={`/community/${discussionGroupId}`}
            className="block rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-center text-xs font-bold text-primary transition hover:bg-primary/20"
          >
            Thao luan
          </Link>
        </div>
      ) : null}

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {chapters.map((chapter) => {
          const isExpanded = expandedChapters.has(chapter.id);
          const chapterCompleted = chapter.lessons.every((l) => l.progress?.isCompleted);
          const chapterLessonsDone = chapter.lessons.filter((l) => l.progress?.isCompleted).length;

          return (
            <div key={chapter.id} className="border-b border-white/[0.06]">
              <button
                onClick={() => toggleChapter(chapter.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-slate-400 transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-200">
                    {chapter.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {chapterLessonsDone}/{chapter.lessons.length} bài
                  </p>
                </div>
                {chapterCompleted && chapter.lessons.length > 0 && (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                )}
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {chapter.lessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLessonId;
                    const isCompleted = lesson.progress?.isCompleted;
                    const isAccessible = enrolled || lesson.isFree;

                    return (
                      <Link
                        key={lesson.id}
                        href={isAccessible ? `/learn/${courseId}/lesson/${lesson.id}` : '#'}
                        className={cn(
                          'group flex items-center gap-3 px-4 py-2.5 pl-10 transition-all',
                          isCurrent
                            ? 'bg-primary/15 border-l-2 border-primary'
                            : 'hover:bg-white/[0.04] border-l-2 border-transparent',
                          !isAccessible && 'cursor-not-allowed opacity-50',
                        )}
                        onClick={(e) => !isAccessible && e.preventDefault()}
                      >
                        <div className="shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="size-4 text-emerald-400" />
                          ) : isCurrent ? (
                            <PlayCircle className="size-4 text-primary" />
                          ) : !isAccessible ? (
                            <Lock className="size-3.5 text-slate-500" />
                          ) : (
                            <div className="size-4 rounded-full border-2 border-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-[13px] font-medium',
                              isCurrent ? 'text-primary' : 'text-slate-300',
                              isCompleted && !isCurrent && 'text-slate-400',
                            )}
                          >
                            {lesson.title}
                          </p>
                        </div>
                        {lesson.duration > 0 && (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                            <Clock3 className="size-3" />
                            {formatDuration(lesson.duration)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
