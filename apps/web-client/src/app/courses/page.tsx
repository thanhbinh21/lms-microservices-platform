import { DiscoveryLayout } from '@/components/discovery/DiscoveryLayout';
import { PublicPageShell } from '@/components/shared/public-page';
import {
  discoverCoursesAction,
  getCategoriesAction,
  type CategoryDto,
  type DiscoveryData,
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

  const data: DiscoveryData | null = coursesResult.success ? coursesResult.data : null;
  const categories: CategoryDto[] = categoriesResult.data ?? [];

  return (
    <PublicPageShell mainClassName="space-y-8 py-8 md:py-10">
      <DiscoveryLayout data={data} categories={categories} />
    </PublicPageShell>
  );
}
