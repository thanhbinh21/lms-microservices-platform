'use server';
import { getInstructorCoursesAction, getPublicCoursesAction } from '@/app/actions/instructor';

interface CourseStat {
  id: string;
  title: string;
  progress: number;
  thumbnail: string;
  instructor: string;
  lastAccessed: string;
}

interface DashboardData {
  stats: {
    totalHours: number;
    coursesCompleted: number;
    certificates: number;
    activeDiscussions: number;
  };
  activeCourses: CourseStat[];
  recommendedCourses: any[];
}

export async function getDashboardData(): Promise<{ success: boolean; data?: DashboardData; seeded: boolean }> {
  const instructorResult = await getInstructorCoursesAction();
  const publicResult = await getPublicCoursesAction(1, 6);

  const instructorCourses = instructorResult.success && instructorResult.data ? instructorResult.data : [];
  const publicCourses = publicResult.success && publicResult.data ? publicResult.data.courses : [];

  const sourceCourses = instructorCourses.length > 0 ? instructorCourses : publicCourses;

  const dashboardData: DashboardData = {
    stats: {
      totalHours: sourceCourses.reduce((acc, item) => acc + Math.floor((item.totalDuration || 0) / 3600), 0),
      coursesCompleted: sourceCourses.filter((item) => item.status === 'PUBLISHED').length,
      certificates: sourceCourses.filter((item) => item.status === 'PUBLISHED').length,
      activeDiscussions: sourceCourses.length,
    },
    activeCourses: sourceCourses.slice(0, 3).map((item, index) => ({
      id: item.id,
      title: item.title,
      progress: Math.max(10, 70 - index * 18),
      thumbnail: (item.title.match(/[A-Za-z]/g)?.slice(0, 2).join('') || 'CRS').toUpperCase(),
      instructor: item.instructorId,
      lastAccessed: index === 0 ? 'Gần đây' : 'Trong tuần này',
    })),
    recommendedCourses: publicCourses.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.level,
      price: `${Number(item.price).toLocaleString('vi-VN')}đ`,
      lessons: item.totalLessons,
      rating: '4.8',
    })),
  };

  return {
    success: true,
    data: dashboardData,
    seeded: false,
  };
}
