'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { AdminInstructorRequestsPanel } from '@/components/admin/AdminInstructorRequestsPanel';

export default function AdminInstructorRequestsPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string | null;

  return (
    <div className="p-6 md:p-8">
      <AdminInstructorRequestsPanel
        requestId={requestId}
        onOpenDetail={(id) => router.push(`/admin/instructor-requests/${encodeURIComponent(id)}`)}
        onBackToList={() => router.push('/admin/instructor-requests')}
      />
    </div>
  );
}
