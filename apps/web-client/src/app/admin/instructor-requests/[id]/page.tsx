'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Điều hướng sang Profile → tab Quản lý đơn GV + chi tiết đơn */
export default function AdminInstructorRequestDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (id) {
      router.replace(`/profile?tab=instructor-requests&requestId=${encodeURIComponent(id)}`);
    } else {
      router.replace('/profile?tab=instructor-requests');
    }
  }, [router, id]);

  return null;
}
