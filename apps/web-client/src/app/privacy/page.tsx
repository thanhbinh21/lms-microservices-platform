'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function PrivacyPage() {
  return (
    <div className="glass-page min-h-screen">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold mb-4">Chính sách bảo mật</h1>
        <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
          <p>Chung toi thu thap thong tin ca nhan chi khi can thiet cho viec cung cap dich vu.</p>
          <p>Thong tin cua ban duoc bao mat va khong chia se cho ben thu ba khi co phep cua ban.</p>
          <p>Ban co quyen truy cap, chinh sua hoac xoa thong tin ca nhan cua minh bat cu luc nao.</p>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
