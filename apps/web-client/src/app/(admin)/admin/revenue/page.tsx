'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminRevenueAnalyticsAction, type AdminRevenueAnalyticsDto } from '@/app/actions/admin';

function formatVnd(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`;
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<AdminRevenueAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await getAdminRevenueAnalyticsAction();
      if (result.success && result.data) {
        setData(result.data);
        setError('');
      } else {
        setError(result.message || 'Không thể tải dữ liệu doanh thu.');
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="workspace-page space-y-6">
      <AdminPageHeader
        eyebrow={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <BarChart3 className="size-3.5" />
            Doanh thu
          </div>
        }
        title="Theo dõi doanh thu"
        description="Tổng hợp GMV, phí nền tảng, phần thực nhận của giảng viên và các khóa học tạo doanh thu tốt nhất."
      />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Tổng GMV" value={loading ? '...' : formatVnd(data?.grossRevenue ?? 0)} hint="Đơn đã thanh toán" />
        <AdminStatCard label="Phí nền tảng" value={loading ? '...' : formatVnd(data?.platformFeeRevenue ?? 0)} hint="Doanh thu nền tảng" tone="success" />
        <AdminStatCard label="Giảng viên thực nhận" value={loading ? '...' : formatVnd(data?.instructorNetRevenue ?? 0)} hint="Ghi nhận earning" />
        <AdminStatCard label="Đơn hoàn tất" value={loading ? '...' : (data?.totalCompletedOrders ?? 0)} hint="COMPLETED orders" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-white/60 bg-white/50 py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Đang tải doanh thu...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-panel rounded-xl border-white/60">
            <CardHeader>
              <CardTitle className="text-lg">Khóa học nổi bật</CardTitle>
              <CardDescription>Xếp theo GMV trong khoảng dữ liệu backend trả về.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.topCourses ?? []).map((item) => (
                <div key={item.courseId} className="rounded-xl border border-white/60 bg-white/45 p-3 text-sm">
                  <p className="font-mono text-xs font-semibold">{item.courseId}</p>
                  <p className="mt-1 text-muted-foreground">{formatVnd(item.grossRevenue)} · {item.completedOrders} đơn</p>
                </div>
              ))}
              {(data?.topCourses?.length ?? 0) === 0 && (
                <div className="rounded-xl border border-dashed border-white/60 bg-white/40 p-8 text-center text-sm text-muted-foreground">
                  Chưa có khóa học phát sinh doanh thu.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel rounded-xl border-white/60">
            <CardHeader>
              <CardTitle className="text-lg">Giảng viên nổi bật</CardTitle>
              <CardDescription>Xếp theo GMV đã hoàn tất.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.topInstructors ?? []).map((item) => (
                <div key={item.instructorId} className="rounded-xl border border-white/60 bg-white/45 p-3 text-sm">
                  <p className="font-mono text-xs font-semibold">{item.instructorId}</p>
                  <p className="mt-1 text-muted-foreground">{formatVnd(item.grossRevenue)} · {item.completedOrders} đơn</p>
                </div>
              ))}
              {(data?.topInstructors?.length ?? 0) === 0 && (
                <div className="rounded-xl border border-dashed border-white/60 bg-white/40 p-8 text-center text-sm text-muted-foreground">
                  Chưa có giảng viên phát sinh doanh thu.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
