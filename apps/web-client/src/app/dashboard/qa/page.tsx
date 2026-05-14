'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { QaTab } from '@/components/dashboard/qa-tab';

export default function QaPage() {
  const { user } = useAppSelector((s) => s.auth);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Hỏi đáp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đặt câu hỏi về khóa học và nhận trả lời từ giảng viên hoặc cộng đồng.
        </p>
      </div>
      <QaTab showFullPageLink={false} />
    </div>
  );
}
