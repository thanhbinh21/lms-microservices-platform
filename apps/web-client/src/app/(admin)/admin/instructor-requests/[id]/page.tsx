'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { AdminInstructorRequestsPanel } from '@/components/admin/AdminInstructorRequestsPanel';

export default function AdminInstructorRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;

  return (
    <div className="p-6 md:p-8">
      <AdminInstructorRequestsPanel
        requestId={id}
        onOpenDetail={(requestId) => router.push(`/admin/instructor-requests/${encodeURIComponent(requestId)}`)}
        onBackToList={() => router.push('/admin/instructor-requests')}
      />
    </div>
  );
}
