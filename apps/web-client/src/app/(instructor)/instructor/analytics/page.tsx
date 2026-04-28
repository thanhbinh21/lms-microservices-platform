'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Users, BarChart3, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getInstructorCoursesAction, getInstructorRevenueAction } from '@/app/actions/instructor';

export default function InstructorAnalyticsPage() {
  const [stats, setStats] = useState({
    views: 'Đang cập nhật',
    enrollments: '0',
    revenue: '0 đ',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      const coursesRes = await getInstructorCoursesAction();
      if (!coursesRes.success || !coursesRes.data) {
        setLoading(false);
        return;
      }

      const courses = coursesRes.data;
      const courseIds = courses.map((c) => c.id);

      const totalEnrollments = courses.reduce((acc, c) => acc + (c._count?.enrollments || 0), 0);

      let totalRevenue = 0;
      if (courseIds.length > 0) {
        const revRes = await getInstructorRevenueAction(courseIds);
        if (revRes.success && revRes.data) {
          totalRevenue = revRes.data.totalRevenue;
        }
      }

      setStats({
        views: 'Đang cập nhật',
        enrollments: totalEnrollments.toLocaleString('vi-VN'),
        revenue: totalRevenue.toLocaleString('vi-VN') + ' đ',
      });
      setLoading(false);
    }
    loadAnalytics();
  }, []);

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Phân tích</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Theo dõi doanh thu, lượt xem và tăng trưởng học viên.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Lượt xem (7 ngày)', value: loading ? '...' : stats.views, icon: TrendingUp },
          { label: 'Học viên', value: loading ? '...' : stats.enrollments, icon: Users },
          { label: 'Doanh thu (thực nhận)', value: loading ? '...' : stats.revenue, icon: BarChart3 },
        ].map((row) => (
          <Card key={row.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{row.label}</CardDescription>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <row.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{row.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart placeholder */}
      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">Biểu đồ doanh thu</CardTitle>
          <CardDescription className="text-xs">Dữ liệu biểu đồ theo thời gian sẽ sớm được cập nhật.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-44 items-center justify-center rounded-xl bg-gradient-to-br from-primary/5 to-transparent text-sm font-medium text-muted-foreground">
            Chưa có dữ liệu biểu đồ
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
