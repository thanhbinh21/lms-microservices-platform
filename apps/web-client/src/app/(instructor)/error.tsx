'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function InstructorError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Instructor route error:', error);
  }, [error]);

  return (
    <div className="p-8 min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-xl font-bold">Không tải được trang giảng viên</h2>
      <p className="text-sm text-muted-foreground">Bạn có thể thử lại sau vài giây.</p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  );
}
