import { Loader2 } from 'lucide-react';

export default function InstructorQaLoading() {
  return (
    <div className="workspace-page space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 flex-1 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm animate-pulse">
            <div className="h-5 w-2/3 rounded bg-slate-100 mb-2" />
            <div className="h-3 w-full rounded bg-slate-100 mb-1" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

