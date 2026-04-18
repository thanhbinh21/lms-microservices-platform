'use server';
import { getPublicCoursesAction } from '@/app/actions/instructor';
import { getMyCoursesAction, type MyCourseSummary } from '@/app/actions/learning';

interface DashboardData {
  stats: {
    totalHours: number;
    coursesCompleted: number;
    certificates: number;
    activeDiscussions: number;
  };
  activeCourses: {
    id: string;
    slug: string;
    title: string;
    progress: number;
    thumbnail: string | null;
    instructor: string;
    lastAccessed: string;
  }[];
  recommendedCourses: {
    id: string;
    title: string;
    category: string;
    price: string;
    lessons: number;
    rating: string;
  }[];
  myCourses: MyCourseSummary[];
}

export async function getDashboardData(): Promise<{ success: boolean; data?: DashboardData; seeded: boolean }> {
  const [myCoursesResult, publicResult] = await Promise.all([
    getMyCoursesAction(),
    getPublicCoursesAction(1, 6),
  ]);

  const myCourses = myCoursesResult.success && myCoursesResult.data ? myCoursesResult.data : [];
  const publicCourses = publicResult.success && publicResult.data ? publicResult.data.courses : [];

  const dashboardData: DashboardData = {
    stats: {
      totalHours: myCourses.reduce((acc: number, item: MyCourseSummary) => acc + Math.floor((item.totalWatchedSeconds || 0) / 3600), 0),
      coursesCompleted: myCourses.filter((item: MyCourseSummary) => item.progressPercent === 100).length,
      certificates: myCourses.filter((item: MyCourseSummary) => item.progressPercent === 100).length,
      activeDiscussions: myCourses.length, // Placeholder
    },
    activeCourses: myCourses
      .filter((c: MyCourseSummary) => c.progressPercent < 100)
      .sort((a: MyCourseSummary, b: MyCourseSummary) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, 3)
      .map((item: MyCourseSummary) => ({
        id: item.id,
        slug: item.slug || item.id,
        title: item.title || 'Khóa học',
        progress: item.progressPercent || 0,
        thumbnail: item.thumbnail,
        instructor: item.instructorId?.slice(0, 8).toUpperCase() || 'HỆ THỐNG',
        lastAccessed: new Date(item.lastAccessedAt || item.enrolledAt).toLocaleDateString('vi-VN'),
      })),
    recommendedCourses: publicCourses.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.level,
      price: `${Number(item.price).toLocaleString('vi-VN')}đ`,
      lessons: item.totalLessons,
      rating: '4.8',
    })),
    myCourses,
  };

  return {
    success: true,
    data: dashboardData,
    seeded: false,
  };
}
