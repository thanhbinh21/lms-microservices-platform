'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Clock3, PlayCircle } from 'lucide-react';
import { getLearnDataAction, type LearnDataDto, type LearnLessonDto } from '@/app/actions/learning';
import { VideoPlayer } from '@/components/learning/video-player';
import { LessonNavigation } from '@/components/learning/lesson-navigation';

function formatDuration(seconds: number) {
  if (!seconds) return '0 phút';
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}ph`;
  return `${m} phút`;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const [data, setData] = useState<LearnDataDto | null>(null);
  const [lesson, setLesson] = useState<LearnLessonDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await getLearnDataAction(courseId);
    if (res.success && res.data) {
      setData(res.data);
      const allLessons = res.data.chapters.flatMap((ch) => ch.lessons);
      const found = allLessons.find((l) => l.id === lessonId);
      setLesson(found || null);
    }
    setLoading(false);
  }, [courseId, lessonId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleComplete = () => {
    fetchData();
  };

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
        <p className="text-lg font-semibold text-slate-600">Bài học không tồn tại</p>
      </div>
    );
  }

  const hasVideo = !!lesson.videoUrl;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-up">
      {/* Video player */}
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
            <p className="text-sm font-medium">Video chưa được tải lên</p>
          </div>
        </div>
      )}

      {/* Lesson info */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          {lesson.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {lesson.duration > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold">
              <Clock3 className="size-3.5" />
              {formatDuration(lesson.duration)}
            </span>
          )}
          {lesson.isFree && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              Miễn phí
            </span>
          )}
        </div>
      </div>

      {/* Lesson navigation */}
      <LessonNavigation
        courseId={courseId}
        chapters={data.chapters}
        currentLessonId={lessonId}
        enrolled={data.enrolled}
      />
    </div>
  );
}
