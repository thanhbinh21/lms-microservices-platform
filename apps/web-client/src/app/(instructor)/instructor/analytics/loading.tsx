import { Loader2 } from 'lucide-react';

export default function AnalyticsLoading() {
  return (
    <div className="workspace-page space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-5 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-white/60 bg-white/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              <div className="size-8 animate-pulse rounded-lg bg-slate-100" />
            </div>
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="size-10 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="mt-3 h-10 w-40 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/50 p-4 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100 mb-4" />
        <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

