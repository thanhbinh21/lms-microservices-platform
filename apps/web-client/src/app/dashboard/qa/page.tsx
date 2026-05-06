import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { QaTab } from '@/components/dashboard/qa-tab';

export default function QaDashboardPage() {
  return (
    <div className="glass-page min-h-screen pb-16">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" />
          Quay lại dashboard
        </Link>
        <section className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-800">Hỏi đáp toàn hệ thống</h1>
          <p className="text-sm text-muted-foreground">Đặt câu hỏi, nhận trả lời, upvote và chọn câu trả lời đúng trên toàn nền tảng.</p>
        </section>
        <QaTab showFullPageLink={false} />
      </main>
    </div>
  );
}
