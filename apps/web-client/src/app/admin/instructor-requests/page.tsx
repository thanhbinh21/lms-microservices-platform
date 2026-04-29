'use client';

import { useParams } from 'next/navigation';
import { AdminInstructorRequestsPanel } from '@/components/admin/AdminInstructorRequestsPanel';

export default function AdminInstructorRequestsPage() {
  const params = useParams();
  const requestId = params.id as string | null;
  return <AdminInstructorRequestsPanel requestId={requestId} onOpenDetail={() => {}} onBackToList={() => {}} />;
}
