'use client';

import { Loader2 } from 'lucide-react';

export default function CertificatesLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-amber-500/10 animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-white/60 p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="size-12 shrink-0 rounded-xl bg-amber-500/15 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
