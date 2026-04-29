'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Users, BarChart3, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getInstructorCoursesAction, getInstructorEarningsSummaryAction } from '@/app/actions/instructor';

export default function InstructorAnalyticsPage() {
  const [stats, setStats] = useState({
    views: '—',
    enrollments: '—',
    totalEarned: '—',
    availableBalance: '—',
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
      const totalEnrollments = courses.reduce((acc, c) => acc + (c._count?.enrollments || 0), 0);

      const earningsRes = await getInstructorEarningsSummaryAction();
      const earnings = earningsRes.success && earningsRes.data ? earningsRes.data : null;

      setStats({
        views: '—',
        enrollments: totalEnrollments.toLocaleString('vi-VN'),
        totalEarned: earnings
          ? (earnings.totalEarned / 1).toLocaleString('vi-VN') + ' đ'
          : '—',
        availableBalance: earnings
          ? (earnings.availableBalance / 1).toLocaleString('vi-VN') + ' đ'
          : '—',
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
          { label: 'Thu nhập khả dụng', value: loading ? '...' : stats.availableBalance, note: 'Sau khi trừ phí 30%', icon: Wallet },
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
              {'note' in row && <p className="text-[11px] text-muted-foreground mt-0.5">{row.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total earnings card */}
      <Card className="mb-6 rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Tổng thu nhập</CardTitle>
            <CardDescription className="text-xs">Tất cả giao dịch (sau phí platform)</CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <BarChart3 className="size-5" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{loading ? '...' : stats.totalEarned}</p>
          <p className="text-xs text-muted-foreground mt-1">Đã trừ phí platform 30% · NexEdu giữ lại 30%</p>
        </CardContent>
      </Card>

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
