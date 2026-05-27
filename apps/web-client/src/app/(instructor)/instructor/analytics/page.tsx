'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, TrendingUp, Users, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getInstructorCoursesAction,
  getInstructorEarningsAction,
  getInstructorEarningsSummaryAction,
  type CourseDto,
  type InstructorEarningDto,
  type InstructorEarningsSummary,
} from '@/app/actions/instructor';

interface ChartBar {
  label: string;
  value: number;
}

function formatVND(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

function SimpleBarChart({ data, maxValue }: { data: ChartBar[]; maxValue: number }) {
  if (data.length === 0 || maxValue === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border bg-white/40 text-center text-sm font-medium text-muted-foreground">
        Chưa có doanh thu trong 6 tháng gần nhất.
      </div>
    );
  }

  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((bar) => {
        const heightPct = maxValue > 0 ? Math.max((bar.value / maxValue) * 100, bar.value > 0 ? 8 : 0) : 0;
        const isHighest = bar.value === maxValue && bar.value > 0;
        return (
          <div key={bar.label} className="group relative flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full items-end">
              <div
                className={`w-full rounded-t-md transition-all ${isHighest ? 'bg-amber-400' : 'bg-primary/70 hover:bg-primary'}`}
                style={{ height: `${heightPct}%`, minHeight: bar.value > 0 ? '4px' : '0' }}
              />
              <div className="absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                {formatVND(bar.value)}
              </div>
            </div>
            <span className="truncate text-[10px] font-semibold text-muted-foreground">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function InstructorAnalyticsPage() {
  const [summary, setSummary] = useState<InstructorEarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<InstructorEarningDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [summaryRes, earningsRes, coursesRes] = await Promise.all([
        getInstructorEarningsSummaryAction(),
        getInstructorEarningsAction(),
        getInstructorCoursesAction(),
      ]);
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (earningsRes.success && earningsRes.data) setEarnings(earningsRes.data);
      if (coursesRes.success && coursesRes.data) setCourses(coursesRes.data);
      if (!summaryRes.success) setErrorMessage(summaryRes.message || 'Không thể tải dữ liệu analytics.');
      setLoading(false);
    }
    void loadData();
  }, []);

  const chartData = useMemo(() => {
    const now = new Date();
    const months: ChartBar[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: date.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }), value: 0 });
    }

    for (const earning of earnings) {
      const date = new Date(earning.createdAt);
      const monthDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
      if (monthDiff >= 0 && monthDiff < 6) {
        months[5 - monthDiff].value += earning.netAmount;
      }
    }

    return months;
  }, [earnings]);

  const maxValue = useMemo(() => Math.max(...chartData.map((bar) => bar.value), 0), [chartData]);
  const courseNameById = useMemo(() => new Map(courses.map((course) => [course.id, course.title])), [courses]);
  const totalStudents = useMemo(() => courses.reduce((sum, course) => sum + (course._count?.enrollments || 0), 0), [courses]);
  const topCourses = useMemo(() => {
    const revenueByCourse = new Map<string, { courseId: string; revenue: number; orders: number }>();
    for (const earning of earnings) {
      const current = revenueByCourse.get(earning.courseId) || { courseId: earning.courseId, revenue: 0, orders: 0 };
      current.revenue += earning.netAmount;
      current.orders += 1;
      revenueByCourse.set(earning.courseId, current);
    }
    return Array.from(revenueByCourse.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [earnings]);

  const totalEarned = summary?.totalEarned ?? 0;
  const availableBalance = summary?.availableBalance ?? 0;
  const platformFeePct = earnings[0]?.platformFeePct ? Math.round(earnings[0].platformFeePct * 100) : 30;

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <BarChart3 className="size-3.5" />
          Analytics
        </div>
        <h1 className="workspace-page-title">Phân tích kênh</h1>
        <p className="workspace-page-description">
          Theo dõi học viên, đơn hàng và doanh thu thực tế từ các API hiện có. Trang này không hiển thị số liệu giả.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Thu nhập khả dụng', value: formatVND(availableBalance), note: 'Có thể rút tại Kênh thanh toán', icon: Wallet, highlight: true },
          { label: 'Tổng thu nhập', value: formatVND(totalEarned), note: `Sau khi trừ phí nền tảng ${platformFeePct}%`, icon: TrendingUp },
          { label: 'Đơn hàng', value: (summary?.totalOrders ?? 0).toLocaleString('vi-VN'), note: 'Đơn đã hoàn tất', icon: BarChart3 },
          { label: 'Học viên', value: totalStudents.toLocaleString('vi-VN'), note: 'Tổng lượt ghi danh từ course API', icon: Users },
        ].map((row) => (
          <Card key={row.label} className={`rounded-2xl border-white/60 bg-white/50 backdrop-blur-md ${row.highlight ? 'border-emerald-200/70' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{row.label}</CardDescription>
              <div className={`flex size-8 items-center justify-center rounded-lg ${row.highlight ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                <row.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? '...' : row.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{loading ? 'Đang tải' : row.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">Doanh thu 6 tháng gần nhất</CardTitle>
            <CardDescription className="text-xs">
              {earnings.length > 0
                ? `Dựa trên ${earnings.length} earning đã ghi nhận. Biểu đồ dùng net amount sau phí nền tảng.`
                : 'Chưa có earning nào. Khi học viên thanh toán khóa học, dữ liệu sẽ xuất hiện tại đây.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">Đang tải biểu đồ...</div>
            ) : (
              <SimpleBarChart data={chartData} maxValue={maxValue} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">Khóa học bán chạy</CardTitle>
            <CardDescription className="text-xs">Xếp hạng theo net earning từ đơn hàng thực tế.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Đang tải khóa học...</p>
            ) : topCourses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-white/40 p-5 text-sm text-muted-foreground">
                Chưa có doanh thu theo khóa học. Đây là trạng thái bình thường nếu bạn chưa có đơn hàng hoàn tất.
              </div>
            ) : (
              topCourses.map((course, index) => (
                <div key={course.courseId} className="rounded-xl border border-slate-200/70 bg-white/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{index + 1}. {courseNameById.get(course.courseId) || `Khóa ${course.courseId.slice(0, 8)}`}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{course.orders} đơn hàng</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-emerald-600">{formatVND(course.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <CardTitle className="text-base">Tín hiệu nội dung</CardTitle>
          </div>
          <CardDescription className="text-xs">Dữ liệu khóa học lấy từ Course Service, không suy diễn ngoài API.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            { label: 'Tổng khóa học', value: courses.length },
            { label: 'Đã xuất bản', value: courses.filter((course) => course.status === 'PUBLISHED').length },
            { label: 'Bản nháp', value: courses.filter((course) => (course.status || 'DRAFT') === 'DRAFT').length },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200/70 bg-white/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-bold">{loading ? '...' : item.value.toLocaleString('vi-VN')}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
