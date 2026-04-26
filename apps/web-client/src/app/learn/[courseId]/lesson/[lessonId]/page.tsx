'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Clock3, PlayCircle, BookOpen, CheckCircle2, ListChecks } from 'lucide-react';
import { getLearnDataAction, type LearnDataDto, type LearnLessonDto } from '@/app/actions/learning';
import { VideoPlayer } from '@/components/learning/video-player';
import { LessonNavigation } from '@/components/learning/lesson-navigation';

function formatDuration(seconds: number) {
  if (!seconds) return '0 phut';
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}ph`;
  return `${m} phut`;
}

export default function LessonPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const [data, setData] = useState<LearnDataDto | null>(null);
  const [lesson, setLesson] = useState<LearnLessonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [certificateNumber, setCertificateNumber] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await getLearnDataAction(courseId);
    if (res.success && res.data) {
      setData(res.data);
      const allLessons = res.data.chapters.flatMap((ch) => ch.lessons);
      const found = allLessons.find((l) => l.id === lessonId);
      setLesson(found || null);
      setCourseCompleted(res.data.progressPercent >= 100);
    }
    setLoading(false);
  }, [courseId, lessonId]);

  useEffect(() => {
    setLoading(true);
    void fetchData();
  }, [fetchData]);

  const handleComplete = (payload?: {
    courseCompleted?: boolean;
    certificateNumber?: string | null;
  }) => {
    if (payload?.courseCompleted) {
      setCourseCompleted(true);
    }
    if (payload?.certificateNumber) {
      setCertificateNumber(payload.certificateNumber);
    }
    void fetchData();
  };

  const lessonMeta = useMemo(() => {
    if (!data || !lesson) {
      return {
        lessonNumber: 0,
        chapterTitle: '',
        chapterLessonDone: 0,
        chapterLessonTotal: 0,
      };
    }

    const allLessons = data.chapters.flatMap((chapter) =>
      chapter.lessons.map((item) => ({ ...item, chapterTitle: chapter.title, chapterLessons: chapter.lessons })),
    );

    const index = allLessons.findIndex((item) => item.id === lesson.id);
    const current = index >= 0 ? allLessons[index] : null;

    const chapterLessonDone = current
      ? current.chapterLessons.filter((l) => l.progress?.isCompleted).length
      : 0;

    return {
      lessonNumber: index + 1,
      chapterTitle: current?.chapterTitle || '',
      chapterLessonDone,
      chapterLessonTotal: current?.chapterLessons.length || 0,
    };
  }, [data, lesson]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !lesson) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold text-slate-600">Bai hoc khong ton tai</p>
      </div>
    );
  }

  const hasVideo = !!lesson.videoUrl;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-up">
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <BookOpen className="size-3.5" />
            Bai {lessonMeta.lessonNumber}/{data.totalLessons}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <ListChecks className="size-3.5" />
            {lessonMeta.chapterTitle || 'Noi dung bai hoc'}
          </span>
          {lesson.duration > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
              <Clock3 className="size-3.5" />
              {formatDuration(lesson.duration)}
            </span>
          )}
          {lesson.isFree && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Mien phi</span>
          )}
          {lesson.progress?.isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Da hoan thanh
            </span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-800">{lesson.title}</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Tien do chuong: {lessonMeta.chapterLessonDone}/{lessonMeta.chapterLessonTotal} bai da hoan thanh.
        </p>
      </section>

      {hasVideo ? (
        <VideoPlayer
          lessonId={lesson.id}
          videoUrl={lesson.videoUrl!}
          sourceType={lesson.sourceType}
          duration={lesson.duration}
          lastPosition={lesson.progress?.lastPosition || 0}
          isCompleted={lesson.progress?.isCompleted || false}
          onComplete={handleComplete}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <PlayCircle className="size-12 stroke-1" />
            <p className="text-sm font-medium">Video chua duoc tai len</p>
          </div>
        </div>
      )}

      <LessonNavigation
        courseId={courseId}
        courseSlug={data.course.slug}
        chapters={data.chapters}
        currentLessonId={lessonId}
        enrolled={data.enrolled}
        currentLessonCompleted={lesson.progress?.isCompleted || false}
        courseCompleted={courseCompleted}
        certificateNumber={certificateNumber}
      />
    </div>
  );
}
