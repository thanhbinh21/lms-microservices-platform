'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LegacyCurriculumRedirectPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const courseId = String(params.courseId);
    router.replace(`/instructor/courses/${courseId}?step=3`);
  }, [params.courseId, router]);

  return null;
}
