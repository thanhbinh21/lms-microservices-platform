'use client';

import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-5 w-96 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-11 w-52 animate-pulse rounded-xl bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border-transparent bg-white/70 p-4 shadow-sm">
            <div className="h-9 w-16 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-36 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex h-28 flex-col items-center justify-center gap-3 rounded-2xl border-transparent bg-white/70 p-5 shadow-sm">
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="h-7 w-40 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-transparent bg-white/70 p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-8 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
