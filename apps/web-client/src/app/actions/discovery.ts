'use server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';

export interface DiscoveryParams {
  q?: string;
  category?: string;
  sortBy?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  level?: string;
  page?: number;
  limit?: number;
}

export interface DiscoveryCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  price: number;
  level: string;
  instructorId: string;
  totalLessons: number;
  totalDuration: number;
  createdAt: string;
  averageRating: number;
  ratingCount: number;
  enrollmentCount: number;
  category: { name: string; slug: string } | null;
  _count?: { enrollments: number };
}

export interface CategoryDto {
  slug: string;
  name: string;
  courseCount: number;
}

export interface DiscoveryFilters {
  categories: CategoryDto[];
  priceRange: { min: number; max: number };
  levels: string[];
}

export interface DiscoveryData {
  courses: DiscoveryCourse[];
  total: number;
  page: number;
  limit: number;
  filters: DiscoveryFilters;
}

export interface DiscoveryResponse {
  success: boolean;
  code: number;
  message: string;
  data: DiscoveryData | null;
  trace_id: string;
}

export interface CategoriesResponse {
  success: boolean;
  code: number;
  message: string;
  data: CategoryDto[] | null;
  trace_id: string;
}

export async function discoverCoursesAction(
  params: DiscoveryParams,
): Promise<DiscoveryResponse> {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        searchParams.set(key, String(value));
      }
    });

    const res = await fetch(
      `${GATEWAY_URL}/course/api/courses?${searchParams.toString()}`,
      { cache: 'no-store' },
    );

    const json = await res.json();
    return json as DiscoveryResponse;
  } catch {
    return {
      success: false,
      code: 500,
      message: 'Failed to fetch courses',
      data: null,
      trace_id: '',
    };
  }
}

export async function getCategoriesAction(): Promise<CategoriesResponse> {
  try {
    const res = await fetch(`${GATEWAY_URL}/course/api/categories`, {
      cache: 'no-store',
    });
    const json = await res.json();
    return json as CategoriesResponse;
  } catch {
    return {
      success: false,
      code: 500,
      message: 'Failed to fetch categories',
      data: null,
      trace_id: '',
    };
  }
}
