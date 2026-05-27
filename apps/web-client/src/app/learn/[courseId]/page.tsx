'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { getLearnDataAction } from '@/app/actions/learning';
import { Button } from '@/components/ui/button';

export default function LearnCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getLearnDataAction(courseId);
      if (!active) return;
      if (!result.success || !result.data) {
        setError(result.message || 'Không thể tải dữ liệu khóa học.');
        setLoading(false);
        return;
      }

      const allLessons = result.data.chapters.flatMap((chapter) => chapter.lessons);
      const lastInProgress = allLessons.find((lesson) => lesson.progress && !lesson.progress.isCompleted && lesson.progress.lastWatched > 0);
      const firstIncomplete = allLessons.find((lesson) => !lesson.progress?.isCompleted);
      const target = lastInProgress || firstIncomplete || allLessons[0];

      if (target) {
        router.replace(`/learn/${courseId}/lesson/${target.id}`);
        return;
      }

      setError('Khóa học chưa có bài học để bắt đầu.');
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [courseId, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Đang chuyển đến bài học phù hợp...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <BookOpen className="size-12 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>Thử lại</Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/courses">Về khóa học của tôi</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
