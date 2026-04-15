'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDashboardData } from '@/app/actions/dashboard';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import Link from 'next/link';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { BookOpen, Clock, Trophy, MessageSquare, PlayCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
          <Link href="/dashboard" className="border-b-2 border-primary pb-0.5 text-primary">
            Tổng quan
          </Link>
          <Link href="#" className="pb-0.5 transition-colors hover:text-primary">
            Khóa học của tôi
          </Link>
          <Link href="#" className="pb-0.5 transition-colors hover:text-primary">
            Chứng chỉ
          </Link>
          <Link href="#" className="pb-0.5 transition-colors hover:text-primary">
            Cộng đồng
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-10 relative z-10">
        
        {/* Welcome Section */}
        <ScrollReveal>
          <div className="rounded-[2rem] border border-white/40 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.85))] p-8 md:p-12 text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold">Chào buổi sáng, {user.name}! 👋</h1>
                <p className="text-white/80 max-w-xl text-sm md:text-base leading-relaxed">
                  Bạn đang làm rất tốt! Tiếp tục chuỗi ngày học tập để hoàn thành khóa {data?.activeCourses?.[0] ? `"${data.activeCourses[0].title}"` : "học của bạn"} nhé. 
                  Hãy nhớ rằng đích đến của bạn là trở thành kỹ sư phần mềm xuất sắc.
                </p>
              </div>
              <Link href={data?.activeCourses?.[0] ? `/learn/${data.activeCourses[0].slug}` : "/courses"}>
                <Button className="w-fit bg-white text-primary hover:bg-white/90 shadow-xl rounded-xl px-6 h-12 font-bold whitespace-nowrap">
                  Tiếp tục học <PlayCircle className="ml-2 size-5" />
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <Loader2 className="size-10 animate-spin text-primary mb-4" />
            <p className="font-medium text-muted-foreground">Đang tải dữ liệu học tập...</p>
          </div>
        ) : (
          <>
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

            {/* Main Content Grid (Active Courses & Recommended) */}
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Active Courses */}
              <div className="lg:col-span-2 space-y-6">
                <ScrollReveal>
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xl font-bold">Lộ Trình Đang Học</h2>
                    <Button variant="link" className="text-primary font-semibold hover:no-underline hover:text-primary/80">Xem tất cả</Button>
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
                        <Card className="glass-panel rounded-2xl border-white/60 hover:shadow-lg transition-all p-4 md:p-6 flex flex-col md:flex-row gap-6 items-center">
                          <div className="w-full md:w-48 aspect-video bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))] rounded-xl border border-white/50 flex items-center justify-center shadow-inner shrink-0">
                            <span className="text-3xl font-bold text-primary/30 uppercase tracking-widest">{course.thumbnail}</span>
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
                             <Link href={`/learn/${course.slug}`} className="w-full md:w-auto">
                               <Button className="w-full rounded-xl shadow-md cursor-pointer pointer-events-auto z-10" onClick={(e) => e.stopPropagation()}>Học tiếp tục</Button>
                             </Link>
                          </div>
                        </Card>
                      </ScrollReveal>
                    ))
                  )}
                </div>
              </div>

              {/* Recommended Courses Sidebar */}
              <div className="space-y-6">
                 <ScrollReveal>
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xl font-bold">Có Thể Bạn Quan Tâm</h2>
                  </div>
                </ScrollReveal>

                <div className="grid gap-4">
                  {data.recommendedCourses.map((course: any, idx: number) => (
                    <ScrollReveal key={idx} delay={idx * 150}>
                       <Card className="glass-panel group rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 border-white/60 flex flex-col">
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
      </main>
    </div>
  );
}
