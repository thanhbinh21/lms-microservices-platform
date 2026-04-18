'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, Sparkles, BookOpen, Trophy } from 'lucide-react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { useAppSelector } from '@/lib/redux/hooks';

const features = [
  {
    icon: MessageSquare,
    title: 'Thảo luận theo bài học',
    description: 'Đặt câu hỏi, chia sẻ bài tập và nhận phản hồi từ giảng viên ngay trong từng video.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Users,
    title: 'Nhóm học tập',
    description: 'Tham gia các nhóm học theo chủ đề, cùng luyện tập với bạn bè và học viên khác.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Sparkles,
    title: 'Bảng xếp hạng & thử thách',
    description: 'Tham gia thử thách hàng tuần, kiếm điểm và leo lên bảng xếp hạng cộng đồng.',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Trophy,
    title: 'Vinh danh học viên xuất sắc',
    description: 'Nhận huy hiệu, chứng nhận và ưu đãi khi duy trì chuỗi học đều đặn.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
];

export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="glass-page relative min-h-screen text-foreground overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-10 w-[40%] h-[40%] rounded-full bg-purple-300/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[45%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />
      <DashboardTabs />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-10 relative z-10">
        <ScrollReveal>
          <div className="rounded-[2rem] border border-white/40 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.85))] p-8 md:p-12 text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                  <Sparkles className="size-3.5" />
                  Sắp ra mắt
                </span>
                <h1 className="text-3xl md:text-4xl font-bold">Cộng đồng học viên NexEdu</h1>
                <p className="text-white/80 text-sm md:text-base leading-relaxed">
                  Học không cô đơn — chia sẻ hành trình, đặt câu hỏi và kết nối với hàng ngàn học
                  viên khác. Tính năng đang được hoàn thiện và sẽ sớm có mặt trong Phase 12.
                </p>
              </div>
              <Link href="/courses">
                <Button className="bg-white text-primary hover:bg-white/90 shadow-xl rounded-xl px-6 h-12 font-bold whitespace-nowrap">
                  Khám phá khóa học
                  <BookOpen className="ml-2 size-5" />
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid gap-5 md:grid-cols-2">
          {features.map((f, idx) => (
            <ScrollReveal key={f.title} delay={idx * 80}>
              <Card className="glass-panel rounded-2xl border-white/60 h-full hover:shadow-lg transition-all">
                <CardContent className="p-6 flex gap-4">
                  <div className={`size-14 shrink-0 rounded-xl ${f.bg} ${f.color} flex items-center justify-center shadow-inner`}>
                    <f.icon className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <Card className="glass-panel rounded-2xl border-dashed border-2 border-white/60 p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Bạn muốn nhận thông báo khi Cộng đồng ra mắt? Chúng tôi sẽ gửi email thông qua
              notification-service khi tính năng được phát hành.
            </p>
          </Card>
        </ScrollReveal>
      </main>
    </div>
  );
}
