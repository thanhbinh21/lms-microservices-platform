import { Loader2 } from 'lucide-react';

export default function InstructorProfileLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
