'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function TermsPage() {
  return (
    <div className="glass-page min-h-screen">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold mb-4">Điều khoản sử dụng</h1>
        <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
          <p>Bang viec su dung NexEdu Academy, ban dong y voi cac dieu khoan su dung sau day.</p>
          <p>1. Tai khoan cua ban phai chinh xac va chi danh cho ca nhan ban.</p>
          <p>2. Ban khong duoc chia se noi dung co ban quyen ma chua duoc phep.</p>
          <p>3. Chung toi bao mat thong tin ca nhan cua ban theo chinh sach bao mat.</p>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
