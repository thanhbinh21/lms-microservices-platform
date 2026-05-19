'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getLearnDataAction } from '@/app/actions/learning';
import { Button } from '@/components/ui/button';

export default function LearnCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getLearnDataAction(courseId);
      if (!res.success || !res.data) {
        setError(res.message || 'Không thể tải dữ liệu khóa học');
        setLoading(false);
        return;
      }

      const { chapters } = res.data;
      const allLessons = chapters.flatMap((ch) => ch.lessons);

      const lastInProgress = allLessons.find(
        (l) => l.progress && !l.progress.isCompleted && l.progress.lastWatched > 0,
      );
      const firstIncomplete = allLessons.find((l) => !l.progress?.isCompleted);
      const target = lastInProgress || firstIncomplete || allLessons[0];

      if (target) {
        router.replace(`/learn/${courseId}/lesson/${target.id}`);
        return;
      }

      setError('Khóa học chưa có bài học để bắt đầu');
      setLoading(false);
    })();
  }, [courseId, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Đang chuyển đến bài học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-slate-700">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            Thu lai
          </Button>
          <Link href="/dashboard/courses">
            <Button variant="ghost">Ve khoa hoc cua toi</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Đang chuyển đến bài học...</p>
      </div>
    </div>
  );
}
