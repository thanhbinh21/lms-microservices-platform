'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminRevenueAnalyticsAction, type AdminRevenueAnalyticsDto } from '@/app/actions/admin';

function formatVnd(value: number) {
  return `${value.toLocaleString('vi-VN')} Ä‘`;
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
    <div className="workspace-page space-y-6">
      <div>
        <h1 className="workspace-page-title">PhÃ¢n tÃ­ch doanh thu</h1>
        <p className="text-sm text-muted-foreground">Doanh thu toÃ n ná»n táº£ng theo cÃ¡c Ä‘Æ¡n Ä‘Ã£ thanh toÃ¡n.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader><CardTitle className="text-sm">Tá»•ng GMV</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : formatVnd(data?.grossRevenue ?? 0)}</CardContent>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader><CardTitle className="text-sm">PhÃ­ ná»n táº£ng</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : formatVnd(data?.platformFeeRevenue ?? 0)}</CardContent>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader><CardTitle className="text-sm">Thá»±c nháº­n giáº£ng viÃªn</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : formatVnd(data?.instructorNetRevenue ?? 0)}</CardContent>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader><CardTitle className="text-sm">ÄÆ¡n hoÃ n táº¥t</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{loading ? '...' : (data?.totalCompletedOrders ?? 0)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader><CardTitle className="text-sm">KhÃ³a há»c ná»•i báº­t</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.topCourses ?? []).map((item) => (
              <div key={item.courseId} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{item.courseId}</p>
                <p className="text-muted-foreground">{formatVnd(item.grossRevenue)} Â· {item.completedOrders} Ä‘Æ¡n</p>
              </div>
            ))}
            {!loading && (data?.topCourses?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">ChÆ°a cÃ³ dá»¯ liá»‡u.</p>}
          </CardContent>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader><CardTitle className="text-sm">Giáº£ng viÃªn ná»•i báº­t</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.topInstructors ?? []).map((item) => (
              <div key={item.instructorId} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{item.instructorId}</p>
                <p className="text-muted-foreground">{formatVnd(item.grossRevenue)} Â· {item.completedOrders} Ä‘Æ¡n</p>
              </div>
            ))}
            {!loading && (data?.topInstructors?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">ChÆ°a cÃ³ dá»¯ liá»‡u.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


