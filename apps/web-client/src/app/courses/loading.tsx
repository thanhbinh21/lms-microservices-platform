import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';

export default function CoursesLoading() {
  return (
    <div className="glass-page min-h-screen text-foreground pb-24 relative overflow-hidden">
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-10%] w-[35%] h-[40%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 relative z-10 space-y-8 animate-pulse">
        {/* Hero skeleton */}
        <div className="flex flex-col items-center space-y-4 pt-10">
          <div className="h-12 w-80 bg-muted rounded-xl" />
          <div className="h-6 w-96 bg-muted rounded-lg" />
          <div className="h-14 w-full max-w-2xl bg-muted rounded-full" />
        </div>

        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between pt-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-10 w-40 bg-muted rounded-xl" />
        </div>

        {/* Content skeleton */}
        <div className="flex gap-8 pt-6">
          <div className="hidden lg:block w-64 space-y-4 shrink-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl bg-muted h-80" />
            ))}
          </div>
        </div>
      </main>

      <SharedFooter />
    </div>
  );
}
