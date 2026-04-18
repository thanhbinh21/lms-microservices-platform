import { Suspense } from 'react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { DiscoveryLayout } from '@/components/discovery/DiscoveryLayout';
import {
  discoverCoursesAction,
  getCategoriesAction,
  type DiscoveryData,
  type CategoryDto,
} from '@/app/actions/discovery';

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;

  const [coursesResult, categoriesResult] = await Promise.all([
    discoverCoursesAction({
      q: params.q || undefined,
      category: params.category || undefined,
      sortBy: params.sortBy || undefined,
      minPrice: params.minPrice ? Number(params.minPrice) : undefined,
      maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
      minRating: params.minRating ? Number(params.minRating) : undefined,
      level: params.level || undefined,
      page: params.page ? Number(params.page) : 1,
      limit: 12,
    }),
    getCategoriesAction(),
  ]);

  const data: DiscoveryData | null = coursesResult.data;
  const categories: CategoryDto[] = categoriesResult.data ?? [];

  return (
    <div className="glass-page min-h-screen text-foreground pb-24 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-10%] w-[35%] h-[40%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 relative z-10 space-y-8">
        <Suspense fallback={<CoursesLoadingSkeleton />}>
          <DiscoveryLayout data={data} categories={categories} />
        </Suspense>
      </main>

      <SharedFooter />
    </div>
  );
}

function CoursesLoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col items-center space-y-4 pt-10">
        <div className="h-12 w-80 bg-muted rounded-xl" />
        <div className="h-6 w-96 bg-muted rounded-lg" />
        <div className="h-14 w-full max-w-2xl bg-muted rounded-full" />
      </div>
      <div className="flex gap-8 pt-6">
        <div className="hidden lg:block w-64 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl bg-muted h-80" />
          ))}
        </div>
      </div>
    </div>
  );
}
