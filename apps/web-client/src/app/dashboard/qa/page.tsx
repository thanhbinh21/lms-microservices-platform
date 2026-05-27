'use client';

import { MessageSquare } from 'lucide-react';
import { QaTab } from '@/components/dashboard/qa-tab';

export default function QaPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <MessageSquare className="size-3.5" />
          Học viên & hỏi đáp
        </div>
        <h1 className="workspace-page-title">Hỏi đáp khóa học</h1>
        <p className="workspace-page-description">
          Đặt câu hỏi theo khóa học đã ghi danh, tìm lại câu hỏi cũ và theo dõi trạng thái đã được giải đáp.
        </p>
      </div>
      <QaTab showFullPageLink={false} />
    </div>
  );
}
