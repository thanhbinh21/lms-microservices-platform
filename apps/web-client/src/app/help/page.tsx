'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function HelpPage() {
  return (
    <div className="glass-page min-h-screen">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold mb-4">Trung tâm trợ giúp</h1>
        <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
          <p>Neu ban can ho tro, vui long lien he qua email: support@nexedu.com</p>
          <p>Chung toi se phan hoi trong vong 24 gio lam viec.</p>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
