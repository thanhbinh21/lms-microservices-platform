'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function ForgotPasswordPage() {
  return (
    <div className="glass-page min-h-screen">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-md px-4 py-16 md:px-6">
        <h1 className="text-2xl font-bold mb-2">Quên mật khẩu</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Nhap dia chi email cua ban de nhan lien ket dat lai mat khau.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Email</label>
            <input
              type="email"
              placeholder="nhapemail@domain.com"
              className="w-full h-12 rounded-xl border border-input bg-white px-4 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            />
          </div>
          <button className="w-full h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">
            Gui lien ket dat lai mat khau
          </button>
          <p className="text-center text-sm text-muted-foreground">
            <a href="/login" className="text-primary font-semibold hover:underline"> Quay lai dang nhap</a>
          </p>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
