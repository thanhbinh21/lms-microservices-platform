'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Download, Loader2, Trophy } from 'lucide-react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { useAppSelector } from '@/lib/redux/hooks';
import { getMyEnrollmentsAction } from '@/app/actions/student';

interface Enrollment {
  id: string;
  courseId: string;
  progress: number;
  enrolledAt: string;
  course?: { title?: string; slug?: string };
}

export default function CertificatesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [items, setItems] = useState<Enrollment[] | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    (async () => {
      const res = await getMyEnrollmentsAction();
      const data: Enrollment[] = res.success && res.data ? (res.data as Enrollment[]) : [];
      setItems(data.filter((item) => (item.progress ?? 0) >= 100));
    })();
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="glass-page relative min-h-screen text-foreground overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-10 w-[40%] h-[40%] rounded-full bg-amber-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />
      <DashboardTabs />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-8 relative z-10">
        <ScrollReveal>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
              <Trophy className="size-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Chứng chỉ của tôi</h1>
              <p className="text-sm font-medium text-muted-foreground">
                Tải chứng chỉ cho các khóa học bạn đã hoàn thành 100%.
              </p>
            </div>
          </div>
        </ScrollReveal>

        {items === null ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <Loader2 className="size-10 animate-spin text-primary mb-4" />
            <p className="font-medium text-muted-foreground">Đang kiểm tra chứng chỉ...</p>
          </div>
        ) : items.length === 0 ? (
          <ScrollReveal>
            <Card className="glass-panel border-dashed border-2 py-16 flex flex-col items-center justify-center text-center">
              <Award className="size-20 text-amber-500/30 mb-4" />
              <h3 className="text-xl font-bold mb-2">Chưa có chứng chỉ nào</h3>
              <p className="text-muted-foreground text-sm font-medium max-w-md mb-6">
                Hoàn thành 100% một khóa học để nhận chứng chỉ. Chứng chỉ sẽ được tự động tạo và có
                thể tải về dưới định dạng PDF.
              </p>
              <Link href="/dashboard/courses">
                <Button className="px-8 font-bold shadow-md rounded-full">Xem khóa học của tôi</Button>
              </Link>
            </Card>
          </ScrollReveal>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((item, idx) => (
              <ScrollReveal key={item.id} delay={idx * 80}>
                <Card className="glass-panel rounded-2xl border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-white/60 p-6 shadow-xl">
                  <CardContent className="p-0 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="size-12 shrink-0 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shadow-inner">
                        <Award className="size-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                          Chứng chỉ hoàn thành
                        </p>
                        <h3 className="mt-1 font-bold leading-tight line-clamp-2">
                          {item.course?.title || 'Khóa học'}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          Cấp cho: <span className="font-bold text-foreground">{user?.name}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                          Hoàn thành: {new Date(item.enrolledAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-amber-200/60">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 rounded-xl font-bold border-amber-300/60"
                        onClick={() =>
                          alert(
                            'Tính năng tải chứng chỉ PDF sẽ được phát hành trong Phase 12. Vui lòng quay lại sau!',
                          )
                        }
                      >
                        <Download className="size-4" />
                        Tải PDF
                      </Button>
                      <Link href={`/courses/${item.course?.slug || item.courseId}`} className="flex-1">
                        <Button variant="ghost" className="w-full rounded-xl font-bold">
                          Xem khóa học
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
