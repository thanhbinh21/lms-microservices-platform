'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Điều hướng sang Cài đặt tài khoản → tab Quản lý đơn GV */
export default function AdminInstructorRequestsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile?tab=instructor-requests');
  }, [router]);

  return null;
}
