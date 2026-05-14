import { MessageSquare, Sparkles } from 'lucide-react';
import { QaTab } from '@/components/dashboard/qa-tab';

export default function InstructorQaPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 rounded-2xl bg-white/70 p-5 shadow-sm">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          Hỏi đáp giảng viên
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Q&A học viên</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trả lời câu hỏi từ học viên. Chọn khóa học để xem câu hỏi cụ thể, hoặc xem toàn bộ.
        </p>
      </div>
      {/* QaTab se tu dong load danh sach khoa hoc cua giang vien */}
      <QaTab showFullPageLink={false} />
    </div>
  );
}
