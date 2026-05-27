'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, CheckCircle2, Clock, Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { getMyCertificatesAction, type MyCertificateSummary, type MyCourseSummary } from '@/app/actions/learning';
import { getMyEnrollmentsAction } from '@/app/actions/student';
import { useAppSelector } from '@/lib/redux/hooks';

export default function CertificatesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [certificates, setCertificates] = useState<MyCertificateSummary[] | null>(null);
  const [enrollments, setEnrollments] = useState<MyCourseSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    async function loadData() {
      const [certRes, enrollRes] = await Promise.all([
        getMyCertificatesAction(),
        getMyEnrollmentsAction(),
      ]);
      if (!certRes.success) {
        const message = certRes.message || 'Không thể tải chứng chỉ.';
        setErrorMessage(message);
        toast('error', 'Tải chứng chỉ thất bại', message);
      }
      setCertificates(certRes.success && certRes.data ? certRes.data : []);
      setEnrollments((enrollRes.success && enrollRes.data ? enrollRes.data : []) as MyCourseSummary[]);
    }
    void loadData();
  }, [isAuthenticated, isLoading, router]);

  const isFetching = certificates === null || enrollments === null;
  const receivedCerts = certificates ?? [];
  const nearCompletion = useMemo(
    () => (enrollments ?? [])
      .filter((item) => item.progressPercent >= 70 && item.progressPercent < 100)
      .sort((a, b) => b.progressPercent - a.progressPercent),
    [enrollments],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Trophy className="size-3.5" />
            Thành tích
          </div>
          <h1 className="workspace-page-title">Chứng chỉ của tôi</h1>
          <p className="workspace-page-description">
            Chứng chỉ được cấp tự động khi bạn hoàn thành 100% khóa học đủ điều kiện.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full rounded-xl font-semibold md:w-auto">
          <Link href="/dashboard/courses">Xem khóa học của tôi</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Đã nhận', value: receivedCerts.length, hint: 'Chứng chỉ đã cấp' },
          { label: 'Sắp đủ điều kiện', value: nearCompletion.length, hint: 'Tiến độ từ 70% trở lên' },
          { label: 'Người nhận', value: user?.name || '-', hint: 'Tên hiển thị trên chứng chỉ' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{isFetching ? '...' : stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      {isFetching ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mb-4 size-10 animate-spin text-primary" />
          <p className="font-medium">Đang kiểm tra chứng chỉ...</p>
        </div>
      ) : receivedCerts.length === 0 && nearCompletion.length === 0 ? (
        <Card className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white/50 py-16 text-center">
          <Award className="mb-4 size-16 text-amber-500/35" />
          <h3 className="mb-2 text-xl font-bold">Chưa có chứng chỉ nào</h3>
          <p className="mb-6 max-w-md text-sm font-medium text-muted-foreground">
            Hoàn thành 100% một khóa học để được cấp chứng chỉ. Khi có chứng chỉ, bạn có thể xem và chia sẻ tại đây.
          </p>
          <Button asChild className="rounded-xl px-8 font-bold shadow-md">
            <Link href="/courses">Khám phá khóa học</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {receivedCerts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <h2 className="text-lg font-bold">Chứng chỉ đã nhận</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{receivedCerts.length}</span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {receivedCerts.map((item) => (
                  <Card key={item.id} className="rounded-2xl border-amber-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-md">
                    <CardContent className="space-y-4 p-0">
                      <div className="flex items-start gap-4">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 shadow-inner">
                          <Award className="size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Chứng chỉ hoàn thành</p>
                          <h3 className="mt-1 line-clamp-2 font-bold leading-tight">{item.course.title}</h3>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">Cấp cho: <span className="font-bold">{user?.name}</span></p>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Hoàn thành: {new Date(item.completedAt).toLocaleDateString('vi-VN')}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-amber-700">Mã: {item.certificateNumber}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 border-t border-amber-200/60 pt-2">
                        <Button asChild variant="outline" className="flex-1 gap-2 rounded-xl border-amber-300/60 font-bold">
                          <Link href={`/certificates/${encodeURIComponent(item.certificateNumber)}`}>
                            <Award className="size-4" /> Xem chứng chỉ
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" className="flex-1 rounded-xl font-bold">
                          <Link href={`/courses/${item.course.slug}`}>Xem khóa học</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {nearCompletion.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-amber-500" />
                <h2 className="text-lg font-bold">Sắp đủ điều kiện</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {nearCompletion.map((item) => {
                  const remaining = Math.max(item.totalLessons - item.completedLessons, 0);
                  return (
                    <Card key={item.id} className="rounded-2xl border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-md">
                      <CardContent className="space-y-3 p-0">
                        <h3 className="line-clamp-2 font-bold leading-tight">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{remaining} bài còn lại để nhận chứng chỉ</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                            <span>Tiến độ</span>
                            <span>{item.progressPercent}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${item.progressPercent}%` }} />
                          </div>
                        </div>
                        <Button asChild className="w-full gap-2 rounded-xl font-bold shadow-md">
                          <Link href={`/learn/${item.id}`}>
                            <Award className="size-4" /> Tiếp tục học
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
