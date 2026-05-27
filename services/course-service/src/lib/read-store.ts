import { getCacheClient, isCacheReady } from '@lms/cache';
import { logger } from '@lms/logger';
import type { CourseCatalogSnapshot } from '@lms/kafka-client';

const READ_KEY_PREFIX = 'course:read:';
const SORT_KEYS = {
  newest: 'course:sort:newest',
  popular: 'course:sort:popular',
  rating: 'course:sort:rating',
  price_asc: 'course:sort:price_asc',
  price_desc: 'course:sort:price_desc',
} as const;
const STATUS_PUBLISHED_KEY = 'course:filter:status:published';

export interface CourseReadModel extends CourseCatalogSnapshot {
  id: string;
}

export interface CourseDiscoveryReadQuery {
  keyword: string;
  categorySlug: string;
  sortBy: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  level: string;
  page: number;
  limit: number;
}

export interface CourseDiscoveryReadResult {
  courses: Array<{
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
  }>;
  total: number;
}

function readKey(courseId: string): string {
  return `${READ_KEY_PREFIX}${courseId}`;
}

function categoryFilterKey(slug: string): string {
  return `course:filter:category:${slug}`;
}

function levelFilterKey(level: string): string {
  return `course:filter:level:${level}`;
}

function sortKey(sortBy: string): keyof typeof SORT_KEYS {
  if (sortBy === 'popular' || sortBy === 'rating' || sortBy === 'price_asc' || sortBy === 'price_desc') {
    return sortBy;
  }
  return 'newest';
}

function shouldReverseSort(sortBy: keyof typeof SORT_KEYS): boolean {
  return sortBy === 'newest' || sortBy === 'popular' || sortBy === 'rating';
}

function parseModel(raw: string | null): CourseReadModel | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CourseReadModel;
  } catch {
    return null;
  }
}

function toListItem(model: CourseReadModel): CourseDiscoveryReadResult['courses'][number] {
  return {
    id: model.id,
    title: model.title,
    slug: model.slug,
    description: model.description,
    thumbnail: model.thumbnail,
    price: model.price,
    level: model.level,
    instructorId: model.instructorId,
    totalLessons: model.totalLessons,
    totalDuration: model.totalDuration,
    createdAt: model.createdAt,
    averageRating: model.averageRating,
    ratingCount: model.ratingCount,
    enrollmentCount: model.enrollmentCount,
    category: model.categoryName && model.categorySlug
      ? { name: model.categoryName, slug: model.categorySlug }
      : null,
  };
}

async function removeIndexEntries(courseId: string, previous?: CourseReadModel | null): Promise<void> {
  const client = getCacheClient();
  if (!client) return;

  await Promise.all([
    client.sRem(STATUS_PUBLISHED_KEY, courseId),
    previous?.categorySlug ? client.sRem(categoryFilterKey(previous.categorySlug), courseId) : Promise.resolve(0),
    previous?.level ? client.sRem(levelFilterKey(previous.level), courseId) : Promise.resolve(0),
    client.zRem(SORT_KEYS.newest, courseId),
    client.zRem(SORT_KEYS.popular, courseId),
    client.zRem(SORT_KEYS.rating, courseId),
    client.zRem(SORT_KEYS.price_asc, courseId),
    client.zRem(SORT_KEYS.price_desc, courseId),
  ]);
}

export async function updateCourseReadModel(courseId: string, snapshot: CourseCatalogSnapshot): Promise<void> {
  const client = getCacheClient();
  if (!client) {
    throw new Error('Course read store Redis is not ready');
  }

  const previous = parseModel(await client.get(readKey(courseId)));
  await removeIndexEntries(courseId, previous);

  if (snapshot.status !== 'PUBLISHED') {
    await client.del(readKey(courseId));
    return;
  }

  const model: CourseReadModel = {
    id: courseId,
    ...snapshot,
    price: Number(snapshot.price),
  };

  const createdAtScore = Date.parse(model.createdAt);
  const newestScore = Number.isFinite(createdAtScore) ? createdAtScore : Date.now();

  await Promise.all([
    client.set(readKey(courseId), JSON.stringify(model)),
    client.sAdd(STATUS_PUBLISHED_KEY, courseId),
    model.categorySlug ? client.sAdd(categoryFilterKey(model.categorySlug), courseId) : Promise.resolve(0),
    client.sAdd(levelFilterKey(model.level), courseId),
    client.zAdd(SORT_KEYS.newest, { score: newestScore, value: courseId }),
    client.zAdd(SORT_KEYS.popular, { score: model.enrollmentCount, value: courseId }),
    client.zAdd(SORT_KEYS.rating, { score: model.averageRating, value: courseId }),
    client.zAdd(SORT_KEYS.price_asc, { score: model.price, value: courseId }),
    client.zAdd(SORT_KEYS.price_desc, { score: -model.price, value: courseId }),
  ]);
}

export async function deleteCourseReadModel(courseId: string): Promise<void> {
  const client = getCacheClient();
  if (!client) {
    throw new Error('Course read store Redis is not ready');
  }

  const previous = parseModel(await client.get(readKey(courseId)));
  await removeIndexEntries(courseId, previous);
  await client.del(readKey(courseId));
}

export async function clearCourseReadStore(): Promise<void> {
  const client = getCacheClient();
  if (!client) {
    throw new Error('Course read store Redis is not ready');
  }

  const keys: string[] = [];
  for await (const key of client.scanIterator({ MATCH: 'course:*', COUNT: 250 })) {
    keys.push(key);
  }

  if (keys.length > 0) {
    await client.del(keys);
  }
}

export async function queryCourseReadStore(
  query: CourseDiscoveryReadQuery,
): Promise<CourseDiscoveryReadResult | null> {
  const client = getCacheClient();
  if (!client || !isCacheReady()) return null;

  // Redis index hien tai chua ho tro full-text search, fallback Prisma de giu ket qua chinh xac.
  if (query.keyword.trim()) return null;

  try {
    const publishedCount = await client.sCard(STATUS_PUBLISHED_KEY);
    if (publishedCount === 0) return null;

    const filterKeys = [STATUS_PUBLISHED_KEY];
    if (query.categorySlug) filterKeys.push(categoryFilterKey(query.categorySlug));
    if (query.level) filterKeys.push(levelFilterKey(query.level));

    const matchedIds = filterKeys.length === 1
      ? await client.sMembers(filterKeys[0])
      : await client.sInter(filterKeys);

    if (matchedIds.length === 0) {
      return { courses: [], total: 0 };
    }

    const selectedSort = sortKey(query.sortBy);
    const sortedIdsRaw = await client.zRange(SORT_KEYS[selectedSort], 0, -1);
    const sortedIds = shouldReverseSort(selectedSort) ? sortedIdsRaw.reverse() : sortedIdsRaw;
    const matchedSet = new Set(matchedIds);
    const orderedIds = sortedIds.filter((id) => matchedSet.has(id));

    if (orderedIds.length === 0) {
      return { courses: [], total: 0 };
    }

    const models = (await client.mGet(orderedIds.map(readKey)))
      .map(parseModel)
      .filter((model): model is CourseReadModel => Boolean(model))
      .filter((model) => query.minPrice === undefined || model.price >= query.minPrice)
      .filter((model) => query.maxPrice === undefined || model.price <= query.maxPrice)
      .filter((model) => query.minRating === undefined || model.averageRating >= query.minRating);

    const total = models.length;
    const skip = (query.page - 1) * query.limit;
    const courses = models.slice(skip, skip + query.limit).map(toListItem);

    return { courses, total };
  } catch (err) {
    logger.warn({ err }, '[course-service] Course read store query failed - fallback Prisma');
    return null;
  }
}
