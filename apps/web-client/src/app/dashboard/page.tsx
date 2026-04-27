'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDashboardData } from '@/app/actions/dashboard';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { DashboardSkeleton, MyCoursesGridSkeleton } from '@/components/learning/dashboard-skeleton';
import Link from 'next/link';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import type { MyCourseSummary } from '@/app/actions/learning';
import {
  Loader2,
} from 'lucide-react';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { MyCoursesTab } from '@/components/dashboard/my-courses-tab';
import { CertificatesTab } from '@/components/dashboard/certificates-tab';
import { CommunityTab } from '@/components/dashboard/community-tab';

type TabId = 'overview' | 'my-courses' | 'certificates' | 'community';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'my-courses', label: 'Khóa học của tôi' },
  { id: 'certificates', label: 'Chứng chỉ' },
  { id: 'community', label: 'Cộng đồng' },
];

type CourseFilter = 'all' | 'in-progress' | 'completed';
type CourseSort = 'recent' | 'progress';

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.ceil((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}ph`;
  return `${m} phút`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function calcStreak(courses: MyCourseSummary[]): number {
  if (courses.length === 0) return 0;
  const accessDates = courses
    .map((c) => {
      const d = new Date(c.lastAccessedAt || c.enrolledAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .reverse();

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (accessDates.includes(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}


export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
  const [courseSort, setCourseSort] = useState<CourseSort>('recent');

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      const res = await getDashboardData();
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    };

    fetchData();
  }, [isAuthenticated, isLoading, router]);

  const myCourses: MyCourseSummary[] = data?.myCourses || [];

  const filteredCourses = useMemo(() => {
    let result = [...myCourses];

    if (courseFilter === 'in-progress') {
      result = result.filter((c) => c.progressPercent < 100);
    } else if (courseFilter === 'completed') {
      result = result.filter((c) => c.progressPercent === 100);
    }

    if (courseSort === 'recent') {
      result.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
    } else {
      result.sort((a, b) => b.progressPercent - a.progressPercent);
    }

    return result;
  }, [myCourses, courseFilter, courseSort]);

  const streak = useMemo(() => calcStreak(myCourses), [myCourses]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const normalizedRole = (user?.role || '').toUpperCase();
  const canBecomeInstructor = isAuthenticated && normalizedRole === 'STUDENT';

  if (!isMounted || isLoading || !user) {
    return (
      <div className="glass-page flex min-h-screen items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-page relative min-h-screen text-foreground overflow-hidden pb-20">
      {/* Decorative Background Orbs */}
      <div className="absolute top-[-10%] right-10 w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] left-[-10%] w-[30%] h-[50%] rounded-full bg-indigo-300/15 blur-[100px] pointer-events-none" />

      <SharedNavbar />

      {/* Thanh dieu huong noi bo Dashboard — giong trang chu, dung chung header co nut Dang ky lam Giang vien + Dang xuat */}
      <div className="relative z-30 border-b border-white/40 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-2.5 text-sm font-semibold text-muted-foreground md:justify-start md:px-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? 'border-b-2 border-primary pb-0.5 text-primary transition-colors cursor-pointer'
                  : 'pb-0.5 transition-colors hover:text-primary cursor-pointer'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-10 relative z-10">

        {loading ? (
          activeTab === 'my-courses' ? <MyCoursesGridSkeleton /> : <DashboardSkeleton />
        ) : (
          <>
            {/* ════════ TAB: TỔNG QUAN ════════ */}
            {activeTab === 'overview' && (
              <OverviewTab
                user={user}
                data={data}
                myCourses={myCourses}
                streak={streak}
                setActiveTab={setActiveTab}
                canBecomeInstructor={canBecomeInstructor}
              />
            )}

            {/* ════════ TAB: KHÓA HỌC CỦA TÔI ════════ */}
            {activeTab === 'my-courses' && (
              <MyCoursesTab
                myCourses={myCourses}
                filteredCourses={filteredCourses}
                courseFilter={courseFilter}
                setCourseFilter={setCourseFilter}
                courseSort={courseSort}
                setCourseSort={setCourseSort}
              />
            )}

            {/* ════════ TAB: CHỨNG CHỈ ════════ */}
            {activeTab === 'certificates' && <CertificatesTab />}

            {/* ════════ TAB: CỘNG ĐỒNG ════════ */}
            {activeTab === 'community' && <CommunityTab />}
          </>
        )}
      </main>
    </div>
  );
}
