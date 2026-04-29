'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function CareersPage() {
  return (
    <div className="glass-page min-h-screen">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold mb-4">Tuyển dụng</h1>
        <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
          <p>Chung toi dang tim nhung nguoi co dam me va duoc dinh huong ky thuat de cung xay dung nen tang hoc tap dac biet tai NexEdu Academy.</p>
          <p>Neu ban quan tam, vui long gui ho so cua ban ve email: careers@nexedu.com</p>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
