'use client';

import Link from 'next/link';
import { BookOpen, BarChart3, Settings, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const quickLinks = [
  {
    title: 'Khóa học',
    description: 'Tạo mới, chỉnh sửa và xuất bản khóa học của bạn.',
    href: '/instructor/courses',
    icon: BookOpen,
  },
  {
    title: 'Phân tích & Doanh thu',
    description: 'Theo dõi lượt xem, đăng ký và doanh thu (dữ liệu mẫu).',
    href: '/instructor/analytics',
    icon: BarChart3,
  },
  {
    title: 'Thiết lập kênh',
    description: 'Thông tin kênh, thanh toán và hiển thị (trang mẫu).',
    href: '/instructor/settings',
    icon: Settings,
  },
];

export default function InstructorStudioHomePage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tổng quan</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
            Trung tâm quản lý nội dung và kênh giảng dạy. Chọn mục bên dưới để tiếp tục.
          </p>
        </div>
        <Button asChild className="w-full shrink-0 rounded-xl font-bold shadow-md md:w-auto">
          <Link href="/instructor/courses/create">
            Tạo khóa học mới
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Khóa học', value: '—', hint: 'Đồng bộ từ API' },
          { label: 'Học viên', value: '—', hint: 'Sắp có' },
          { label: 'Doanh thu (mẫu)', value: '0 đ', hint: 'Phân tích' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wide">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="group block">
            <Card className="h-full rounded-2xl border-white/60 bg-white/50 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription className="text-sm font-medium leading-relaxed">{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center text-sm font-bold text-primary group-hover:underline">
                  Mở trang
                  <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
