'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getLearnDataAction } from '@/app/actions/learning';

export default function LearnCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  useEffect(() => {
    (async () => {
      const res = await getLearnDataAction(courseId);
      if (!res.success || !res.data) return;

      const { chapters } = res.data;
      const allLessons = chapters.flatMap((ch) => ch.lessons);

      const lastInProgress = allLessons.find(
        (l) => l.progress && !l.progress.isCompleted && l.progress.watchedDuration > 0,
      );
      const firstIncomplete = allLessons.find((l) => !l.progress?.isCompleted);
      const target = lastInProgress || firstIncomplete || allLessons[0];

      if (target) {
        router.replace(`/learn/${courseId}/lesson/${target.id}`);
      }
    })();
  }, [courseId, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Đang chuyển đến bài học...</p>
      </div>
    </div>
  );
}
