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
  BookOpen,
  Clock,
  Trophy,
  MessageSquare,
  PlayCircle,
  ArrowRight,
  GraduationCap,
  Flame,
  Activity,
  Award,
  Users,
  Sparkles,
  Filter,
  SortAsc,
  Loader2,
} from 'lucide-react';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';

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

  const normalizedRole = (user?.role || '').toUpperCase();
  const canBecomeInstructor = isAuthenticated && normalizedRole === 'STUDENT';

  if (isLoading || !user) return null;

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
              <>
                {/* Welcome Section */}
                <ScrollReveal>
                  <div className="rounded-[2rem] border border-white/40 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.85))] p-8 md:p-12 text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1 min-w-0">
                        <h1 className="text-3xl md:text-4xl font-bold break-words">{getGreeting()}, {user.name}! 👋</h1>
                        <p className="text-white/80 max-w-xl text-sm md:text-base leading-relaxed">
                          {data?.activeCourses?.length > 0
                            ? `Bạn đang làm rất tốt! Tiếp tục chuỗi ${streak > 0 ? `${streak} ngày` : ''} học tập để hoàn thành khóa "${data.activeCourses[0].title}" nhé.`
                            : 'Bắt đầu hành trình học tập của bạn ngay hôm nay! Khám phá các khóa học phù hợp với mục tiêu của bạn.'
                          }
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Link href={data?.activeCourses?.[0] ? `/learn/${data.activeCourses[0].id}` : "/courses"}>
                          <Button className="w-fit bg-white text-primary hover:bg-white/90 shadow-xl rounded-xl px-6 h-12 font-bold whitespace-nowrap">
                            {data?.activeCourses?.length > 0 ? 'Tiếp tục học' : 'Khám phá khóa học'} <PlayCircle className="ml-2 size-5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {[
                    { label: 'Giờ học tích lũy', value: `${data.stats.totalHours}h`, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Khóa đã hoàn thành', value: data.stats.coursesCompleted, icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Chứng chỉ đạt được', value: data.stats.certificates, icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    { label: 'Thảo luận', value: data.stats.activeDiscussions, icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                  ].map((stat, idx) => (
                    <ScrollReveal key={idx} delay={idx * 100}>
                      <Card className="glass-panel rounded-2xl border-white/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 pointer-events-none">
                        <CardContent className="p-6 flex items-center gap-4">
                          <div className={`size-14 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 shadow-inner`}>
                            <stat.icon className="size-6 stroke-[2]" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">{stat.label}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>
                  ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid lg:grid-cols-3 gap-8">

                  {/* Active Courses */}
                  <div className="lg:col-span-2 space-y-6">
                    <ScrollReveal>
                      <div className="flex items-center justify-between px-1">
                        <h2 className="text-xl font-bold">Lộ Trình Đang Học</h2>
                        <Button
                          variant="link"
                          className="text-primary font-semibold hover:no-underline hover:text-primary/80"
                          onClick={() => setActiveTab('my-courses')}
                        >
                          Xem tất cả
                        </Button>
                      </div>
                    </ScrollReveal>

                    <div className="space-y-4">
                      {data.activeCourses.length === 0 ? (
                        <Card className="glass-panel border-dashed border-2 py-12 flex flex-col items-center justify-center text-center">
                          <BookOpen className="size-16 text-muted-foreground/30 mb-4" />
                          <h3 className="text-xl font-bold mb-2">Bạn chưa có khóa học nào</h3>
                          <p className="text-muted-foreground text-sm font-medium max-w-sm mb-6">Bạn cần đăng ký khóa học để bắt đầu theo dõi lộ trình của mình. Hãy khám phá ngay!</p>
                          <Link href="/courses">
                            <Button className="px-8 font-bold shadow-md rounded-full">Khám phá khóa học</Button>
                          </Link>
                        </Card>
                      ) : (
                        data.activeCourses.map((course: any, idx: number) => (
                          <ScrollReveal key={idx} delay={idx * 100}>
                            <Card className="glass-panel glass-card-hover rounded-2xl border-white/60 p-4 md:p-6 flex flex-col md:flex-row gap-6 items-center">
                              <div className="w-full md:w-48 aspect-video rounded-xl border border-white/50 shadow-inner shrink-0 overflow-hidden bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))]">
                                {course.thumbnail ? (
                                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-3xl font-bold text-primary/30 uppercase tracking-widest">
                                      {(course.title?.match(/[A-Za-z]/g)?.slice(0, 2).join('') || 'CRS').toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 w-full space-y-4">
                                <div>
                                  <p className="text-xs font-semibold text-primary mb-1">Giảng viên: {course.instructor}</p>
                                  <h3 className="text-lg font-bold leading-tight">{course.title}</h3>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                                    <span>Hoàn thành {course.progress}%</span>
                                    <span>Truy cập: {course.lastAccessed}</span>
                                  </div>
                                  <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${course.progress}%` }} />
                                  </div>
                                </div>
                              </div>
                              <div className="w-full md:w-auto shrink-0 flex items-center md:items-end md:h-full">
                                <Link href={`/learn/${course.id}`} className="w-full md:w-auto">
                                  <Button className="w-full rounded-xl shadow-md cursor-pointer pointer-events-auto z-10" onClick={(e) => e.stopPropagation()}>Học tiếp tục</Button>
                                </Link>
                              </div>
                            </Card>
                          </ScrollReveal>
                        ))
                      )}
                    </div>

                    {/* Become Educator CTA */}
                    {canBecomeInstructor && (
                      <ScrollReveal delay={200}>
                        <Card className="glass-panel rounded-2xl border-white/60 p-6 md:p-8 overflow-hidden relative">
                          <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-400/15 rounded-full blur-[40px] pointer-events-none" />
                          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="size-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                              <GraduationCap className="size-7" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold">Trở thành Giảng viên</h3>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                Chia sẻ kiến thức, tạo khóa học và kiếm thu nhập. Đăng ký ngay để bắt đầu hành trình giảng dạy!
                              </p>
                            </div>
                            <Link href="/become-instructor" className="shrink-0">
                              <Button className="gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-amber-500/20 px-6">
                                Đăng ký ngay <ArrowRight className="size-4" />
                              </Button>
                            </Link>
                          </div>
                        </Card>
                      </ScrollReveal>
                    )}
                  </div>

                  {/* Right Sidebar */}
                  <div className="space-y-6">
                    {/* Learning Streak */}
                    <ScrollReveal>
                      <Card className="glass-panel rounded-2xl border-white/60">
                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="size-11 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shadow-inner">
                              <Flame className="size-5 stroke-[2.5]" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold tracking-tight">{streak}</p>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chuỗi ngày học</p>
                            </div>
                          </div>
                          {/* 7-day streak dots */}
                          <div className="flex items-center gap-1.5 justify-between pt-1">
                            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => {
                              const today = new Date();
                              const dayOfWeek = today.getDay();
                              const mondayBased = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                              const isActive = i <= mondayBased && i >= mondayBased - streak + 1;
                              return (
                                <div key={day} className="flex flex-col items-center gap-1.5">
                                  <div
                                    className={`size-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                      isActive
                                        ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md shadow-orange-400/30'
                                        : 'bg-secondary/60 text-muted-foreground/50'
                                    }`}
                                  >
                                    {isActive ? '🔥' : ''}
                                  </div>
                                  <span className="text-[10px] font-semibold text-muted-foreground/60">{day}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </ScrollReveal>

                    {/* Recent Activity */}
                    <ScrollReveal delay={100}>
                      <div className="flex items-center justify-between px-1 mb-3">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                          <Activity className="size-4 text-primary" />
                          Hoạt động gần đây
                        </h2>
                      </div>
                      <div className="space-y-2">
                        {myCourses.length === 0 ? (
                          <Card className="glass-panel rounded-xl p-4 text-center">
                            <p className="text-sm text-muted-foreground font-medium">Chưa có hoạt động nào</p>
                          </Card>
                        ) : (
                          myCourses
                            .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
                            .slice(0, 4)
                            .map((course, idx) => (
                              <Link key={idx} href={`/learn/${course.id}`}>
                                <div className="glass-panel rounded-xl p-3 flex items-center gap-3 hover:bg-white/50 transition-colors cursor-pointer group">
                                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <PlayCircle className="size-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                      {course.title}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                      {course.completedLessons}/{course.totalLessons} bài · {new Date(course.lastAccessedAt).toLocaleDateString('vi-VN')}
                                    </p>
                                  </div>
                                  <span className="text-xs font-bold text-primary shrink-0">{course.progressPercent}%</span>
                                </div>
                              </Link>
                            ))
                        )}
                      </div>
                    </ScrollReveal>

                    {/* Recommended Courses */}
                    <ScrollReveal delay={200}>
                      <div className="flex items-center justify-between px-1">
                        <h2 className="text-lg font-bold">Có Thể Bạn Quan Tâm</h2>
                      </div>
                    </ScrollReveal>

                    <div className="grid gap-4">
                      {data.recommendedCourses.map((course: any, idx: number) => (
                        <ScrollReveal key={idx} delay={idx * 150}>
                          <Card className="glass-panel glass-card-hover group rounded-2xl border-white/60 flex flex-col">
                            <CardContent className="p-4 space-y-3">
                              <div className="relative aspect-video overflow-hidden rounded-xl bg-[linear-gradient(120deg,hsl(var(--primary)/0.05),hsl(var(--primary)/0.01))] border border-white/50 border-b-0 shadow-inner">
                                <span className="absolute right-2 top-2 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-primary shadow-sm border border-primary/10">
                                  {course.category}
                                </span>
                              </div>
                              <div>
                                <p className="line-clamp-2 text-sm font-bold leading-tight mb-2 group-hover:text-primary transition-colors">{course.title}</p>
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-primary">{course.price}</span>
                                  <span className="text-muted-foreground flex items-center gap-1">⭐ {course.rating}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </ScrollReveal>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ════════ TAB: KHÓA HỌC CỦA TÔI ════════ */}
            {activeTab === 'my-courses' && (
              <div className="space-y-8 animate-fade-up">
                {/* Header */}
                <ScrollReveal>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Khóa học của tôi</h2>
                      <p className="text-sm text-muted-foreground font-medium mt-1">
                        {myCourses.length} khóa học · {myCourses.filter((c) => c.progressPercent === 100).length} hoàn thành
                      </p>
                    </div>
                    <Link href="/courses">
                      <Button variant="outline" className="gap-2 rounded-xl border-primary/30 font-bold">
                        <Sparkles className="size-4" />
                        Khám phá thêm
                      </Button>
                    </Link>
                  </div>
                </ScrollReveal>

                {/* Filter + Sort Bar */}
                <ScrollReveal delay={50}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
                      <Filter className="size-3.5" />
                    </div>
                    {([
                      ['all', 'Tất cả'],
                      ['in-progress', 'Đang học'],
                      ['completed', 'Hoàn thành'],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setCourseFilter(key)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                          courseFilter === key
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'bg-white/50 text-muted-foreground hover:bg-white/80 border border-white/60'
                        }`}
                      >
                        {label}
                        {key === 'all' && ` (${myCourses.length})`}
                        {key === 'in-progress' && ` (${myCourses.filter((c) => c.progressPercent < 100).length})`}
                        {key === 'completed' && ` (${myCourses.filter((c) => c.progressPercent === 100).length})`}
                      </button>
                    ))}

                    <div className="ml-auto flex items-center gap-2">
                      <SortAsc className="size-3.5 text-muted-foreground" />
                      <select
                        value={courseSort}
                        onChange={(e) => setCourseSort(e.target.value as CourseSort)}
                        className="text-xs font-semibold bg-white/50 border border-white/60 rounded-lg px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="recent">Mới truy cập</option>
                        <option value="progress">Tiến độ</option>
                      </select>
                    </div>
                  </div>
                </ScrollReveal>

                {/* Course Grid */}
                {filteredCourses.length === 0 ? (
                  <ScrollReveal>
                    <Card className="glass-panel border-dashed border-2 py-16 flex flex-col items-center justify-center text-center rounded-2xl">
                      <BookOpen className="size-16 text-muted-foreground/30 mb-4" />
                      <h3 className="text-xl font-bold mb-2">
                        {courseFilter === 'all' ? 'Bạn chưa đăng ký khóa học nào' : courseFilter === 'in-progress' ? 'Không có khóa đang học' : 'Chưa hoàn thành khóa nào'}
                      </h3>
                      <p className="text-muted-foreground text-sm font-medium max-w-md mb-6">
                        {courseFilter === 'all'
                          ? 'Hãy khám phá kho khóa học đa dạng và bắt đầu hành trình học tập ngay!'
                          : 'Thử thay đổi bộ lọc hoặc khám phá thêm khóa học mới.'}
                      </p>
                      <Link href="/courses">
                        <Button className="px-8 font-bold shadow-md rounded-full">Khám phá khóa học</Button>
                      </Link>
                    </Card>
                  </ScrollReveal>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course, idx) => (
                      <ScrollReveal key={course.id} delay={idx * 80}>
                        <Card className="glass-panel glass-card-hover rounded-2xl border-white/60 flex flex-col overflow-hidden group">
                          {/* Thumbnail */}
                          <div className="aspect-video bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))] relative overflow-hidden">
                            {course.thumbnail ? (
                              <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="size-12 text-primary/20" />
                              </div>
                            )}
                            {/* Overlay badges */}
                            <div className="absolute top-3 left-3 flex gap-2">
                              {course.enrollmentType === 'FREE' && (
                                <span className="rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                  Miễn phí
                                </span>
                              )}
                              <span className="rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold text-primary shadow-sm border border-primary/10">
                                {course.level}
                              </span>
                            </div>
                            {course.progressPercent === 100 && (
                              <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                                <div className="size-14 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                  <Trophy className="size-7 text-white" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-5 flex flex-col flex-1 space-y-3">
                            <div className="flex-1 min-h-0">
                              <h3 className="text-sm font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                {course.title}
                              </h3>
                              <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
                                {course.completedLessons}/{course.totalLessons} bài · {formatDuration(course.totalWatchedSeconds)}
                              </p>
                            </div>

                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="text-muted-foreground">Tiến độ</span>
                                <span className={course.progressPercent === 100 ? 'text-emerald-600' : 'text-primary'}>
                                  {course.progressPercent}%
                                </span>
                              </div>
                              <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden shadow-inner">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${
                                    course.progressPercent === 100
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                      : 'bg-primary'
                                  }`}
                                  style={{ width: `${course.progressPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Action */}
                            <Link href={`/learn/${course.id}`} className="mt-auto">
                              <Button
                                className={`w-full rounded-xl font-bold shadow-md cursor-pointer ${
                                  course.progressPercent === 100
                                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                                    : ''
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {course.progressPercent === 100 ? (
                                  <>Xem lại <Trophy className="ml-2 size-4" /></>
                                ) : course.progressPercent > 0 ? (
                                  <>Học tiếp tục <PlayCircle className="ml-2 size-4" /></>
                                ) : (
                                  <>Bắt đầu học <ArrowRight className="ml-2 size-4" /></>
                                )}
                              </Button>
                            </Link>
                          </div>
                        </Card>
                      </ScrollReveal>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════ TAB: CHỨNG CHỈ ════════ */}
            {activeTab === 'certificates' && (
              <ScrollReveal>
                <Card className="glass-panel rounded-2xl border-white/60 py-20 flex flex-col items-center justify-center text-center">
                  <div className="size-20 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6 shadow-inner">
                    <Award className="size-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">Chứng chỉ đạt được</h2>
                  <p className="text-muted-foreground text-sm font-medium max-w-md mb-2 leading-relaxed">
                    Tính năng chứng chỉ sẽ sớm được triển khai. Hoàn thành các khóa học để nhận chứng chỉ xác nhận năng lực!
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm font-semibold text-amber-600">
                    <Sparkles className="size-4" />
                    Sắp ra mắt
                  </div>
                </Card>
              </ScrollReveal>
            )}

            {/* ════════ TAB: CỘNG ĐỒNG ════════ */}
            {activeTab === 'community' && (
              <ScrollReveal>
                <Card className="glass-panel rounded-2xl border-white/60 py-20 flex flex-col items-center justify-center text-center">
                  <div className="size-20 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6 shadow-inner">
                    <Users className="size-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">Cộng đồng học tập</h2>
                  <p className="text-muted-foreground text-sm font-medium max-w-md mb-2 leading-relaxed">
                    Kết nối với học viên khác, trao đổi kiến thức và cùng nhau phát triển. Tính năng đang được phát triển!
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm font-semibold text-purple-600">
                    <Sparkles className="size-4" />
                    Sắp ra mắt
                  </div>
                </Card>
              </ScrollReveal>
            )}
          </>
        )}
      </main>
    </div>
  );
}
