'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function AboutPage() {
  return (
    <div className="glass-page min-h-screen">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold mb-4">Giới thiệu NexEdu Academy</h1>
        <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
          <p>NexEdu Academy la nen tang hoc tap thoi dai, giup nguoi hoc nam bat kien thuc va ky nang thuc tien de dat duoc muc tieu nghe nghiep cua minh.</p>
          <p>Chung toi ket noi hoc vien voi cac chuyen gia trong nganh, mang den trai nghiem hoc tap ca nhan hoa va chat luong cao.</p>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
