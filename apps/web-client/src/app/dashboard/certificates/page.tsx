'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Loader2, Trophy, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';
import { getMyCertificatesAction, type MyCertificateSummary } from '@/app/actions/learning';
import { getMyEnrollmentsAction } from '@/app/actions/student';
import type { MyCourseSummary } from '@/app/actions/learning';

export default function CertificatesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [certificates, setCertificates] = useState<MyCertificateSummary[] | null>(null);
  const [enrollments, setEnrollments] = useState<MyCourseSummary[] | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    (async () => {
      const [certRes, enrollRes] = await Promise.all([
        getMyCertificatesAction(),
        getMyEnrollmentsAction(),
      ]);
      setCertificates(certRes.success && certRes.data ? certRes.data : []);
      const enrollData = (enrollRes.success && enrollRes.data ? enrollRes.data : []) as MyCourseSummary[];
      setEnrollments(enrollData);
    })();
  }, [isAuthenticated, isLoading, router]);

  const isFetching = certificates === null || enrollments === null;

  const receivedCerts = certificates ?? [];
  const nearCompletion = enrollments
    ? enrollments
        .filter((e) => e.progressPercent >= 70 && e.progressPercent < 100)
        .sort((a, b) => b.progressPercent - a.progressPercent)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
          <Trophy className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chứng chỉ của tôi</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Danh sách chứng chỉ được cấp từ các khóa học đã hoàn thành.
          </p>
        </div>
      </div>

      {isFetching ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-60">
          <Loader2 className="size-10 animate-spin text-primary mb-4" />
          <p className="font-medium text-muted-foreground">Đang kiểm tra chứng chỉ...</p>
        </div>
      ) : receivedCerts.length === 0 && nearCompletion.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 py-16 flex flex-col items-center justify-center text-center">
          <Award className="size-20 text-amber-500/30 mb-4" />
          <h3 className="text-xl font-bold mb-2">Chưa có chứng chỉ nào</h3>
          <p className="text-muted-foreground text-sm font-medium max-w-md mb-6">
            Hoàn thành 100% một khóa học để được cấp chứng chỉ. Chứng chỉ sẽ được tạo tự động.
          </p>
          <Link href="/courses">
            <Button className="px-8 font-bold shadow-md rounded-full">Khám phá khóa học</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-10">
          {receivedCerts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <h2 className="text-lg font-bold">Chứng chỉ đã nhận</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  {receivedCerts.length}
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {receivedCerts.map((item) => (
                  <Card key={item.id} className="rounded-2xl border-amber-200/60 bg-gradient-to-br from-amber-50/60 to-white/60 p-6 shadow-xl">
                    <CardContent className="p-0 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="size-12 shrink-0 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shadow-inner">
                          <Award className="size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                            Chứng chỉ hoàn thành
                          </p>
                          <h3 className="mt-1 font-bold leading-tight line-clamp-2">{item.course.title}</h3>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            Cấp cho: <span className="font-bold">{user?.name}</span>
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                            Hoàn thành: {new Date(item.completedAt).toLocaleDateString('vi-VN')}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                            Mẫu: {item.template?.name || 'Mặc định'}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                            Mã: {item.certificateNumber}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-amber-200/60">
                        <Link href={`/certificates/${encodeURIComponent(item.certificateNumber)}`} className="flex-1">
                          <Button variant="outline" className="w-full gap-2 rounded-xl font-bold border-amber-300/60">
                            <Award className="size-4" />
                            Xem chứng chỉ
                          </Button>
                        </Link>
                        <Link href={`/courses/${item.course.slug}`} className="flex-1">
                          <Button variant="ghost" className="w-full rounded-xl font-bold">
                            Xem khóa học
                          </Button>
                        </Link>
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
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  {nearCompletion.length}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {nearCompletion.map((item) => {
                  const remaining = item.totalLessons - item.completedLessons;
                  return (
                    <Card key={item.id} className="rounded-2xl border-transparent bg-white/70 p-5 shadow-sm hover:shadow-md transition-all">
                      <CardContent className="p-0 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold leading-tight line-clamp-2">{item.title}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {remaining} bài còn lại để nhận chứng chỉ
                            </p>
                          </div>
                          {item.thumbnail && (
                            <img src={item.thumbnail} alt={item.title} className="size-12 rounded-lg object-cover shrink-0" />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                            <span>Tiến độ</span>
                            <span>{item.progressPercent}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-secondary/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.completedLessons}/{item.totalLessons} bài đã hoàn thành
                          </p>
                        </div>
                        <Link href={`/learn/${item.id}`}>
                          <Button className="w-full gap-2 rounded-xl font-bold shadow-md">
                            <Award className="size-4" />
                            Tiếp tục học
                          </Button>
                        </Link>
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
