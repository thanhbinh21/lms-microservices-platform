import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { CommunityTab } from '@/components/dashboard/community-tab';

export default function CommunityPage() {
  return (
    <div className="glass-page min-h-screen pb-16">
      <SharedNavbar />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Quay lai dashboard
        </Link>

        <section className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-800">Cong dong khoa hoc</h1>
          <p className="text-sm text-muted-foreground">
            Theo doi cac nhom da tham gia va vao trang thao luan de trao doi cung hoc vien khac.
          </p>
        </section>

        <CommunityTab />
      </main>
    </div>
  );
}
