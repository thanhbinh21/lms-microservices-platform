import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Trophy, MessageSquare, Clock, PlayCircle, GraduationCap, ArrowRight, Flame, Activity } from 'lucide-react';
import Link from 'next/link';
import { StatCard } from './stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { OverviewCourseCard } from './overview-course-card';

interface OverviewTabProps {
  user: any;
  data: any;
  myCourses: any[];
  streak: number;
  setActiveTab: (tab: any) => void;
  canBecomeInstructor: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function OverviewTab({ user, data, myCourses, streak, setActiveTab, canBecomeInstructor }: OverviewTabProps) {
  return (
    <>
      {/* Welcome Section */}
      <ScrollReveal>
        <div className="rounded-[2rem] border border-white/40 gradient-hero p-8 md:p-12 text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
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
          <StatCard
            key={idx}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            colorClass={stat.color}
            bgClass={stat.bg}
            delay={idx * 100}
          />
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
              <EmptyState
                icon={BookOpen}
                title="Bạn chưa có khóa học nào"
                description="Bạn cần đăng ký khóa học để bắt đầu theo dõi lộ trình của mình. Hãy khám phá ngay!"
                actionLabel="Khám phá khóa học"
                actionHref="/courses"
              />
            ) : (
              data.activeCourses.map((course: any, idx: number) => (
                <OverviewCourseCard key={idx} course={course} delay={idx * 100} />
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

          {/* Quick Actions */}
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                            {course.title}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                            Hoàn thành {course.progressPercent}%
                          </p>
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                      </div>
                    </Link>
                  ))
              )}
            </div>
          </ScrollReveal>

          {/* Recommended Courses */}
          <ScrollReveal delay={200}>
            <div className="flex items-center justify-between px-1 mt-6">
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
  );
}
