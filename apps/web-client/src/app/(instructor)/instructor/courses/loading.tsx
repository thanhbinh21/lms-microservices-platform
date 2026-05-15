import { Loader2 } from 'lucide-react';

export default function InstructorCourseListLoading() {
  return (
    <div className="workspace-page space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="size-5 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 flex-1 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-8 flex-1 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

