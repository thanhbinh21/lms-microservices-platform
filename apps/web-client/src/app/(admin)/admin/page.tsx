'use client';

import { useEffect, useState } from 'react';
import { Users, BookOpen, GraduationCap, Flag, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { getAdminUserStats, getAdminCourseStats } from '@/app/actions/admin';

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}

export default function AdminDashboardPage() {
  const [userStats, setUserStats] = useState<any>(null);
  const [courseStats, setCourseStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [userRes, courseRes] = await Promise.all([
        getAdminUserStats(),
        getAdminCourseStats(),
      ]);
      if (userRes.success) setUserStats(userRes.data);
      if (courseRes.success) setCourseStats(courseRes.data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards: StatCard[] = [
    {
      label: 'Tổng người dùng',
      value: loading ? '...' : String(userStats?.totalUsers ?? 0),
      hint: loading ? 'Đang tải' : `${userStats?.activeUsers ?? 0} đang hoạt động`,
      icon: <Users className="size-5" />,
    },
    {
      label: 'Khóa học đã xuất bản',
      value: loading ? '...' : String(courseStats?.publishedCourses ?? 0),
      hint: loading ? 'Đang tải' : `${courseStats?.totalCourses ?? 0} tổng khóa học`,
      icon: <BookOpen className="size-5" />,
    },
    {
      label: 'Tổng lượt ghi danh',
      value: loading ? '...' : (courseStats?.totalEnrollments ?? 0).toLocaleString('vi-VN'),
      hint: 'Tổng học viên đã đăng ký',
      icon: <GraduationCap className="size-5" />,
    },
    {
      label: 'Đánh giá bị gắn cờ',
      value: loading ? '...' : String(courseStats?.flaggedReviews ?? 0),
      hint: 'Cần kiểm duyệt',
      icon: <Flag className="size-5" />,
    },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Admin
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Tổng quan hệ thống</h1>
        <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
          Bảng điều khiển quản trị — theo dõi người dùng, khóa học, đánh giá và hệ thống.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                {stat.label}
              </CardDescription>
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg">Người dùng theo vai trò</CardTitle>
            <CardDescription>Phân bổ vai trò trong hệ thống</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { role: 'STUDENT', count: userStats?.studentCount ?? 0 },
                  { role: 'INSTRUCTOR', count: userStats?.instructorCount ?? 0 },
                  { role: 'ADMIN', count: userStats?.adminCount ?? 0 },
                ].map((item) => (
                  <div key={item.role} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white/70 px-4 py-3">
                    <StatusBadge status={item.role} />
                    <span className="text-sm font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg">Khóa học theo trạng thái</CardTitle>
            <CardDescription>Phân bổ trạng thái khóa học</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { status: 'PUBLISHED', count: courseStats?.publishedCourses ?? 0 },
                  { status: 'DRAFT', count: courseStats?.draftCourses ?? 0 },
                  { status: 'ARCHIVED', count: courseStats?.archivedCourses ?? 0 },
                ].map((item) => (
                  <div key={item.status} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white/70 px-4 py-3">
                    <StatusBadge status={item.status} />
                    <span className="text-sm font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
