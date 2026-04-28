'use client';

import { Bell, CreditCard, UserCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function InstructorChannelSettingsPage() {
  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kênh</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Cấu hình thông tin kênh và cách hiển thị với học viên.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thông tin kênh</CardTitle>
            </div>
            <CardDescription className="text-xs">Tên hiển thị và mô tả ngắn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Tên kênh</label>
              <Input placeholder="VD: NexEdu — Lập trình Web" className="rounded-xl" disabled />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Giới thiệu kênh</label>
              <textarea className="min-h-20 w-full rounded-xl border border-input bg-white p-3 text-sm" placeholder="Mô tả ngắn về nội dung bạn giảng dạy..." disabled />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thanh toán</CardTitle>
            </div>
            <CardDescription className="text-xs">Cấu hình nhận thanh toán.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Liên kết ví / tài khoản ngân hàng sẽ được thêm ở phiên bản sau.
            </p>
            <Button type="button" variant="outline" className="mt-4 rounded-xl font-bold" disabled>
              Lưu (chưa kích hoạt)
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thông báo</CardTitle>
            </div>
            <CardDescription className="text-xs">Email khi có đăng ký mới hoặc bình luận.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Chưa có tùy chọn — giao diện giữ chỗ.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
