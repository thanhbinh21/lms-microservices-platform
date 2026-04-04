'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StatusMessage } from '@/components/ui/status-message';

export function InstructorRequestFlash() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('instructorSubmitted') === '1') {
      setVisible(true);
      const path = window.location.pathname;
      router.replace(path, { scroll: false });
    }
  }, [searchParams, router]);

  if (!visible) return null;

  return (
    <div className="relative z-30 mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
      <StatusMessage
        type="success"
        message="Đã gửi hồ sơ đăng ký giảng viên thành công. Ban quản trị sẽ xem xét và phản hồi sớm nhất có thể."
      />
    </div>
  );
}
