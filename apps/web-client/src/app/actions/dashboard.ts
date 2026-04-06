'use server';
import { getPublicCoursesAction } from '@/app/actions/instructor';
import { getMyEnrollmentsAction } from '@/app/actions/student';

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
  const enrollmentResult = await getMyEnrollmentsAction();
  const publicResult = await getPublicCoursesAction(1, 6);

  const enrollments = enrollmentResult.success && enrollmentResult.data ? enrollmentResult.data : [];
  const publicCourses = publicResult.success && publicResult.data ? publicResult.data.courses : [];

  const dashboardData: DashboardData = {
    stats: {
      totalHours: enrollments.reduce((acc: number, item: any) => acc + Math.floor((item.course?.totalDuration || 0) / 3600), 0),
      coursesCompleted: enrollments.filter((item: any) => item.progress === 100).length,
      certificates: enrollments.filter((item: any) => item.progress === 100).length,
      activeDiscussions: enrollments.length, // Placeholder
    },
    activeCourses: enrollments.map((item: any) => ({
      id: item.courseId,
      slug: item.course?.slug || item.courseId,
      title: item.course?.title || 'Khóa học',
      progress: item.progress || 0,
      thumbnail: (item.course?.title.match(/[A-Za-z]/g)?.slice(0, 2).join('') || 'CRS').toUpperCase(),
      instructor: item.course?.instructorId?.slice(0, 8).toUpperCase() || 'HỆ THỐNG',
      lastAccessed: new Date(item.lastAccessedAt || item.enrolledAt).toLocaleDateString('vi-VN'),
    })).filter((c: any) => c.progress <= 100), // Exclude fully completed if we want active courses - maybe we want to show it, so <= 100 is fine
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
