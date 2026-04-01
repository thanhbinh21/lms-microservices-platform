'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Global route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-2xl font-bold">Đã xảy ra lỗi ngoài mong đợi</h2>
      <p className="text-sm text-muted-foreground">Vui lòng thử tải lại trang để tiếp tục.</p>
      <Button onClick={reset}>Tải lại</Button>
    </div>
  );
}
