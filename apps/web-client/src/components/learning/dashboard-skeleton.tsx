'use client';

export function DashboardSkeleton() {
  return (
    <div className="space-y-10 animate-fade-up">
      {/* Welcome hero skeleton */}
      <div className="rounded-[2rem] border border-white/40 bg-primary/20 p-8 md:p-12 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="skeleton-shimmer h-9 w-72 max-w-full rounded-xl" />
            <div className="skeleton-shimmer h-4 w-96 max-w-full rounded-lg" />
            <div className="skeleton-shimmer h-4 w-80 max-w-full rounded-lg" />
          </div>
          <div className="skeleton-shimmer h-12 w-40 rounded-xl" />
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="glass-panel rounded-2xl border-white/60 p-6"
          >
            <div className="flex items-center gap-4">
              <div className="skeleton-shimmer size-14 rounded-xl" />
              <div className="space-y-2 flex-1">
                <div className="skeleton-shimmer h-6 w-16 rounded-lg" />
                <div className="skeleton-shimmer h-3 w-24 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Course cards skeleton */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="skeleton-shimmer h-6 w-48 rounded-lg" />
            <div className="skeleton-shimmer h-5 w-20 rounded-lg" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="glass-panel rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-6 items-center"
              >
                <div className="skeleton-shimmer w-full md:w-48 aspect-video rounded-xl" />
                <div className="flex-1 w-full space-y-4">
                  <div className="space-y-2">
                    <div className="skeleton-shimmer h-3 w-32 rounded-md" />
                    <div className="skeleton-shimmer h-5 w-64 max-w-full rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <div className="skeleton-shimmer h-3 w-24 rounded-md" />
                      <div className="skeleton-shimmer h-3 w-28 rounded-md" />
                    </div>
                    <div className="skeleton-shimmer h-2 w-full rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-6">
          <div className="skeleton-shimmer h-6 w-40 rounded-lg" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 space-y-3">
                <div className="skeleton-shimmer w-full aspect-video rounded-xl" />
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-4 w-full rounded-md" />
                  <div className="flex justify-between">
                    <div className="skeleton-shimmer h-3 w-16 rounded-md" />
                    <div className="skeleton-shimmer h-3 w-12 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyCoursesGridSkeleton() {
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Filter bar skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-9 w-24 rounded-full" />
        ))}
        <div className="ml-auto skeleton-shimmer h-9 w-36 rounded-lg" />
      </div>

      {/* Course grid skeleton */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel rounded-2xl overflow-hidden">
            <div className="skeleton-shimmer w-full aspect-video" style={{ borderRadius: 0 }} />
            <div className="p-5 space-y-3">
              <div className="skeleton-shimmer h-4 w-full rounded-md" />
              <div className="skeleton-shimmer h-4 w-2/3 rounded-md" />
              <div className="space-y-2 pt-2">
                <div className="flex justify-between">
                  <div className="skeleton-shimmer h-3 w-24 rounded-md" />
                  <div className="skeleton-shimmer h-3 w-10 rounded-md" />
                </div>
                <div className="skeleton-shimmer h-2 w-full rounded-full" />
              </div>
              <div className="skeleton-shimmer h-10 w-full rounded-xl mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
