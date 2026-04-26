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
import { getMyCertificatesAction, type MyCertificateSummary } from '@/app/actions/learning';

function downloadCertificateText(params: {
  certificateNumber: string;
  learnerName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
}) {
  const content = [
    'LMS CERTIFICATE OF COMPLETION',
    '',
    `Certificate Number: ${params.certificateNumber}`,
    `Learner: ${params.learnerName}`,
    `Course: ${params.courseTitle}`,
    `Completed At: ${new Date(params.completedAt).toLocaleDateString('vi-VN')}`,
    `Issued At: ${new Date(params.issuedAt).toLocaleDateString('vi-VN')}`,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `certificate-${params.certificateNumber}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export default function CertificatesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [items, setItems] = useState<MyCertificateSummary[] | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    (async () => {
      const res = await getMyCertificatesAction();
      const data: MyCertificateSummary[] = res.success && res.data ? res.data : [];
      setItems(data);
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
              <h1 className="text-3xl font-bold tracking-tight">Chung chi cua toi</h1>
              <p className="text-sm font-medium text-muted-foreground">
                Danh sach chung chi duoc cap tu cac khoa hoc ban da hoan thanh.
              </p>
            </div>
          </div>
        </ScrollReveal>

        {items === null ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <Loader2 className="size-10 animate-spin text-primary mb-4" />
            <p className="font-medium text-muted-foreground">Dang kiem tra chung chi...</p>
          </div>
        ) : items.length === 0 ? (
          <ScrollReveal>
            <Card className="glass-panel border-dashed border-2 py-16 flex flex-col items-center justify-center text-center">
              <Award className="size-20 text-amber-500/30 mb-4" />
              <h3 className="text-xl font-bold mb-2">Chua co chung chi nao</h3>
              <p className="text-muted-foreground text-sm font-medium max-w-md mb-6">
                Hoan thanh 100% mot khoa hoc de duoc cap chung chi. Chung chi se duoc tao tu dong.
              </p>
              <Link href="/dashboard/courses">
                <Button className="px-8 font-bold shadow-md rounded-full">Xem khoa hoc cua toi</Button>
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
                          Chung chi hoan thanh
                        </p>
                        <h3 className="mt-1 font-bold leading-tight line-clamp-2">{item.course.title}</h3>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          Cap cho: <span className="font-bold text-foreground">{user?.name}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                          Hoan thanh: {new Date(item.completedAt).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                          Ma chung chi: {item.certificateNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-amber-200/60">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 rounded-xl font-bold border-amber-300/60"
                        onClick={() =>
                          downloadCertificateText({
                            certificateNumber: item.certificateNumber,
                            learnerName: user?.name || 'Hoc vien',
                            courseTitle: item.course.title,
                            completedAt: item.completedAt,
                            issuedAt: item.issuedAt,
                          })
                        }
                      >
                        <Download className="size-4" />
                        Tai chung chi
                      </Button>
                      <Link href={`/courses/${item.course.slug}`} className="flex-1">
                        <Button variant="ghost" className="w-full rounded-xl font-bold">
                          Xem khoa hoc
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
