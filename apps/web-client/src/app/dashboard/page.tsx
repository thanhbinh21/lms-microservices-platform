'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardSkeleton, MyCoursesGridSkeleton } from '@/components/learning/dashboard-skeleton';
import Link from 'next/link';
import type { MyCourseSummary } from '@/app/actions/learning';
import {
  ArrowLeft, Award, BookOpen, LayoutDashboard, Loader2, Menu, MessageSquare, X,
} from 'lucide-react';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { MyCoursesTab } from '@/components/dashboard/my-courses-tab';
import { CertificatesTab } from '@/components/dashboard/certificates-tab';
import { QaTab } from '@/components/dashboard/qa-tab';

type TabId = 'overview' | 'my-courses' | 'certificates' | 'qa';
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'my-courses', label: 'Khóa học của tôi' },
  { id: 'certificates', label: 'Chứng chỉ' },
  { id: 'qa', label: 'Global Q&A' },
];
const TAB_ICONS: Record<TabId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  'my-courses': BookOpen,
  certificates: Award,
  qa: MessageSquare,
};
type CourseFilter = 'all' | 'in-progress' | 'completed';
type CourseSort = 'recent' | 'progress';

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
    if (accessDates.includes(key)) streak++;
    else if (i > 0) break;
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const fetchData = async () => {
      const res = await getDashboardData();
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    };
    void fetchData();
  }, [isAuthenticated, isLoading, router]);

  const myCourses: MyCourseSummary[] = data?.myCourses || [];
  const filteredCourses = useMemo(() => {
    let result = [...myCourses];
    if (courseFilter === 'in-progress') result = result.filter((c) => c.progressPercent < 100);
    else if (courseFilter === 'completed') result = result.filter((c) => c.progressPercent === 100);
    if (courseSort === 'recent') result.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
    else result.sort((a, b) => b.progressPercent - a.progressPercent);
    return result;
  }, [myCourses, courseFilter, courseSort]);
  const streak = useMemo(() => calcStreak(myCourses), [myCourses]);

  const normalizedRole = (user?.role || '').toUpperCase();
  const canBecomeInstructor = isAuthenticated && normalizedRole === 'STUDENT';
  if (!isMounted || isLoading || !user) {
    return <div className="glass-page flex min-h-screen items-center justify-center"><Loader2 className="size-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="glass-page flex min-h-screen text-foreground">
      <div className="glass-navbar fixed top-0 z-40 flex w-full items-center justify-between px-4 py-3 md:hidden">
        <Link href="/" className="text-sm font-bold">NexEdu Dashboard</Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((p) => !p)} aria-label="Mở menu dashboard">
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`glass-panel fixed left-0 top-0 z-40 h-screen w-72 border-r border-white/50 transition-transform duration-200 md:sticky md:w-64 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col overflow-y-auto p-6 pt-20 md:pt-6">
          <h2 className="mb-5 text-lg font-bold">Bảng điều khiển học viên</h2>
          <div className="space-y-1">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-transparent hover:bg-white/40'}`}
                >
                  <span className="inline-flex items-center gap-2"><Icon className="size-4" />{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => router.push('/')}>
              <ArrowLeft className="size-4" /> Về trang chủ
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen flex-1 overflow-x-hidden pb-20 pt-16 md:pt-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-10 relative z-10">
          {loading ? (
            activeTab === 'my-courses' ? <MyCoursesGridSkeleton /> : <DashboardSkeleton />
          ) : (
            <>
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
              {activeTab === 'certificates' && <CertificatesTab />}
              {activeTab === 'qa' && <QaTab showFullPageLink={false} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
