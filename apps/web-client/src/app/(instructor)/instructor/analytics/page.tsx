'use client';

import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InstructorAnalyticsPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Phân tích & Doanh thu</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Trang mẫu — kết nối API thống kê sau. Hiện hiển thị dữ liệu giả lập để tránh lỗi 404.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Lượt xem (7 ngày)', value: '0', icon: TrendingUp },
          { label: 'Đăng ký mới', value: '0', icon: Users },
          { label: 'Doanh thu ước tính', value: '0 đ', icon: BarChart3 },
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

      <Card className="rounded-2xl border-dashed border-white/60 bg-white/40">
        <CardHeader>
          <CardTitle className="text-lg">Biểu đồ (mẫu)</CardTitle>
          <CardDescription>Khi backend sẵn sàng, biểu đồ theo thời gian sẽ hiển thị tại đây.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-xl bg-gradient-to-br from-primary/5 to-transparent text-sm font-medium text-muted-foreground">
            Chưa có dữ liệu — đây là vùng placeholder
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
