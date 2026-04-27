'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getInstructorCoursesAction, getInstructorRevenueAction } from '@/app/actions/instructor';

export default function InstructorAnalyticsPage() {
  const [stats, setStats] = useState({
    views: '0',
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
        views: 'Đang cập nhật', // TODO: Tích hợp views sau
        enrollments: totalEnrollments.toLocaleString('vi-VN'),
        revenue: totalRevenue.toLocaleString('vi-VN') + ' đ',
      });
      setLoading(false);
    }
    loadAnalytics();
  }, []);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Phân tích & Doanh thu</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Thống kê dữ liệu đăng ký và doanh thu từ các khoá học của bạn.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Lượt xem (7 ngày)', value: loading ? '...' : stats.views, icon: TrendingUp },
          { label: 'Học viên', value: loading ? '...' : stats.enrollments, icon: Users },
          { label: 'Doanh thu (thực nhận)', value: loading ? '...' : stats.revenue, icon: BarChart3 },
        ].map((row) => (
          <Card key={row.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="text-xs font-semibold uppercase">{row.label}</CardDescription>
              <row.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{row.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Biểu đồ (Sắp ra mắt)</CardTitle>
          <CardDescription>Biểu đồ theo dõi doanh thu theo thời gian sẽ sớm được cập nhật.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-xl bg-gradient-to-br from-primary/5 to-transparent text-sm font-medium text-muted-foreground">
            Chưa có dữ liệu biểu đồ
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
