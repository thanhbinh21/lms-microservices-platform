'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CourseDetailError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Course detail route error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-2xl font-bold">Không tải được chi tiết khóa học</h2>
      <p className="text-sm text-muted-foreground">Vui lòng thử lại hoặc quay về danh sách khóa học.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Thử lại</Button>
        <Button asChild variant="outline">
          <Link href="/courses">Về trang khóa học</Link>
        </Button>
      </div>
    </div>
  );
}
