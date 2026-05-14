import { Loader2 } from 'lucide-react';

export default function InstructorCourseDetailLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
