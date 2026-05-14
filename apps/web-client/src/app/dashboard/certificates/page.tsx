'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Loader2, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';
import { getMyCertificatesAction, type MyCertificateSummary } from '@/app/actions/learning';

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

      {items === null ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-60">
          <Loader2 className="size-10 animate-spin text-primary mb-4" />
          <p className="font-medium text-muted-foreground">Đang kiểm tra chứng chỉ...</p>
        </div>
      ) : items.length === 0 ? (
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
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((item) => (
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
      )}
    </div>
  );
}
