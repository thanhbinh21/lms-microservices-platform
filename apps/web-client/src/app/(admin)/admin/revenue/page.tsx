'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminRevenueAnalyticsAction, type AdminRevenueAnalyticsDto } from '@/app/actions/admin';

function formatVnd(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`;
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<AdminRevenueAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getAdminRevenueAnalyticsAction();
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue Analytics</h1>
        <p className="text-sm text-muted-foreground">Doanh thu toàn nền tảng theo đơn đã thanh toán.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">GMV</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : formatVnd(data?.grossRevenue ?? 0)}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Platform Fee</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : formatVnd(data?.platformFeeRevenue ?? 0)}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Net To Instructors</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : formatVnd(data?.instructorNetRevenue ?? 0)}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Completed Orders</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : (data?.totalCompletedOrders ?? 0)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Top Courses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.topCourses ?? []).map((item) => (
              <div key={item.courseId} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{item.courseId}</p>
                <p className="text-muted-foreground">{formatVnd(item.grossRevenue)} · {item.completedOrders} orders</p>
              </div>
            ))}
            {!loading && (data?.topCourses?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Khong co du lieu.</p>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Top Instructors</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.topInstructors ?? []).map((item) => (
              <div key={item.instructorId} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{item.instructorId}</p>
                <p className="text-muted-foreground">{formatVnd(item.grossRevenue)} · {item.completedOrders} orders</p>
              </div>
            ))}
            {!loading && (data?.topInstructors?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Khong co du lieu.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
