import { Loader2 } from 'lucide-react';

export default function InstructorOverviewLoading() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="space-y-2">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-5 w-96 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm">
            <div className="h-8 w-16 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="size-12 animate-pulse rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
