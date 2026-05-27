'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, ChevronDown, Clock3, Lock, PlayCircle } from 'lucide-react';
import type { LearnChapterDto } from '@/app/actions/learning';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number) {
  if (!seconds) return '';
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} phút`;
}

interface CurriculumSidebarProps {
  courseId: string;
  chapters: LearnChapterDto[];
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
}

export function CurriculumSidebar({
  courseId,
  chapters,
  enrolled,
  completedLessons,
  totalLessons,
  progressPercent,
}: CurriculumSidebarProps) {
  const params = useParams();
  const currentLessonId = params.lessonId as string | undefined;
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    const current = new Set<string>();
    for (const chapter of chapters) {
      if (chapter.lessons.some((lesson) => lesson.id === currentLessonId)) current.add(chapter.id);
    }
    if (current.size === 0 && chapters.length > 0) current.add(chapters[0].id);
    return current;
  });

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
      <div className="border-b border-white/10 p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-300">
          <span>{completedLessons}/{totalLessons} bài hoàn thành</span>
          <span className="text-emerald-400">{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chapters.map((chapter) => {
          const isExpanded = expandedChapters.has(chapter.id);
          const chapterCompleted = chapter.lessons.length > 0 && chapter.lessons.every((lesson) => lesson.progress?.isCompleted);
          const chapterLessonsDone = chapter.lessons.filter((lesson) => lesson.progress?.isCompleted).length;

          return (
            <div key={chapter.id} className="border-b border-white/[0.06]">
              <button type="button" onClick={() => toggleChapter(chapter.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]">
                <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform duration-200', isExpanded && 'rotate-180')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-200">{chapter.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{chapterLessonsDone}/{chapter.lessons.length} bài</p>
                </div>
                {chapterCompleted ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : null}
              </button>

              {isExpanded ? (
                <div className="pb-1">
                  {chapter.lessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLessonId;
                    const isCompleted = Boolean(lesson.progress?.isCompleted);
                    const isAccessible = enrolled || lesson.isFree;

                    return (
                      <Link
                        key={lesson.id}
                        href={isAccessible ? `/learn/${courseId}/lesson/${lesson.id}` : '#'}
                        className={cn(
                          'group flex items-center gap-3 border-l-2 px-4 py-2.5 pl-10 transition-all',
                          isCurrent ? 'border-primary bg-primary/15' : 'border-transparent hover:bg-white/[0.05]',
                          !isAccessible && 'cursor-not-allowed opacity-50',
                        )}
                        onClick={(event) => {
                          if (!isAccessible) event.preventDefault();
                        }}
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
                        <p className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', isCurrent ? 'text-primary' : 'text-slate-300', isCompleted && !isCurrent && 'text-slate-400')}>
                          {lesson.title}
                        </p>
                        {lesson.duration > 0 ? (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                            <Clock3 className="size-3" />
                            {formatDuration(lesson.duration)}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
