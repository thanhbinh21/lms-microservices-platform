'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, BookOpen, GraduationCap, Flag, Sparkles, Headphones, CreditCard, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  getAdminUserStats,
  getAdminCourseStats,
  getAdminFailedEventStats,
  getAdminPayoutsAction,
} from '@/app/actions/admin';
import { getAdminSupportTicketsAction } from '@/app/actions/support';

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger';
  href?: string;
}

export default function AdminDashboardPage() {
  const [userStats, setUserStats] = useState<any>(null);
  const [courseStats, setCourseStats] = useState<any>(null);
  const [dlqStats, setDlqStats] = useState<any>(null);
  const [supportStats, setSupportStats] = useState<{ open: number; inProgress: number }>({ open: 0, inProgress: 0 });
  const [payoutStats, setPayoutStats] = useState<{ pending: number }>({ pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [userRes, courseRes, dlqRes, supportOpenRes, supportInProgRes, payoutRes] = await Promise.all([
        getAdminUserStats(),
        getAdminCourseStats(),
        getAdminFailedEventStats(),
        getAdminSupportTicketsAction({ page: 1, limit: 1, status: 'OPEN' }),
        getAdminSupportTicketsAction({ page: 1, limit: 1, status: 'IN_PROGRESS' }),
        getAdminPayoutsAction({ page: 1, limit: 1, status: 'PENDING' }),
      ]);
      if (userRes.success) setUserStats(userRes.data);
      if (courseRes.success) setCourseStats(courseRes.data);
      if (dlqRes.success) setDlqStats(dlqRes.data);
      const open = supportOpenRes.data?.pagination?.total ?? 0;
      const inProg = supportInProgRes.data?.pagination?.total ?? 0;
      setSupportStats({ open, inProgress: inProg });
      const pending = payoutRes.data?.pagination?.total ?? 0;
      setPayoutStats({ pending });
      setLoading(false);
    };
    void fetchStats();
  }, []);

  const totalSupport = supportStats.open + supportStats.inProgress;
  const pendingCount = dlqStats?.pendingCount ?? 0;
  const flaggedReviews = courseStats?.flaggedReviews ?? 0;

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
      value: loading ? '...' : String(flaggedReviews),
      hint: 'Cần kiểm duyệt',
      icon: <Flag className="size-5" />,
      variant: flaggedReviews > 0 ? 'warning' : 'default',
      href: '/admin/reviews',
    },
    {
      label: 'Yêu cầu hỗ trợ',
      value: loading ? '...' : String(totalSupport),
      hint: loading ? 'Đang tải' : `${supportStats.open} mới · ${supportStats.inProgress} đang xử lý`,
      icon: <Headphones className="size-5" />,
      variant: totalSupport > 0 ? 'warning' : 'default',
      href: '/admin/support',
    },
    {
      label: 'Yêu cầu rút tiền',
      value: loading ? '...' : String(payoutStats.pending),
      hint: 'Chờ duyệt',
      icon: <CreditCard className="size-5" />,
      variant: payoutStats.pending > 0 ? 'warning' : 'default',
      href: '/admin/payouts',
    },
    {
      label: 'Sự kiện thất bại (DLQ)',
      value: loading ? '...' : String(pendingCount),
      hint: 'Chờ xử lý lại',
      icon: <AlertTriangle className="size-5" />,
      variant: pendingCount > 0 ? 'danger' : 'default',
      href: '/admin/system',
    },
  ];

  const getCardClass = (variant?: string) => {
    if (variant === 'danger') return 'border-amber-300 bg-amber-50/30';
    if (variant === 'warning') return 'border-amber-200 bg-amber-50/20';
    return 'border-white/60 bg-white/50';
  };

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
        {statCards.map((stat) => {
          if (stat.href) {
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className={`rounded-2xl ${getCardClass(stat.variant)} transition hover:shadow-md cursor-pointer`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                      {stat.label}
                    </CardDescription>
                    <div className={`flex size-9 items-center justify-center rounded-lg ${stat.variant === 'danger' ? 'bg-amber-100 text-amber-600' : stat.variant === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                      {stat.icon}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          }

          return (
            <div key={stat.label}>
              <Card className={`rounded-2xl ${getCardClass(stat.variant)} transition`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                    {stat.label}
                  </CardDescription>
                  <div className={`flex size-9 items-center justify-center rounded-lg ${stat.variant === 'danger' ? 'bg-amber-100 text-amber-600' : stat.variant === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                    {stat.icon}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
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

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { href: '/admin/support', title: 'Hỗ trợ & Giải quyết', desc: 'Xử lý yêu cầu hỗ trợ từ học viên và giảng viên' },
          { href: '/admin/payouts', title: 'Thanh toán & Payout', desc: 'Duyệt yêu cầu rút tiền của giảng viên' },
          { href: '/admin/system', title: 'DLQ & System Events', desc: 'Giám sát và xử lý các sự kiện thất bại' },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md transition hover:bg-white/70">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
