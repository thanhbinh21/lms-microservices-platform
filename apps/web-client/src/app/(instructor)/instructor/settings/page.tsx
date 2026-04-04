'use client';

import { Bell, CreditCard, UserCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function InstructorChannelSettingsPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Thiết lập kênh</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Trang mẫu — lưu cấu hình kênh sẽ được nối backend sau. Các ô nhập chỉ để minh họa giao diện.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="size-5 text-primary" />
              <CardTitle className="text-lg">Thông tin kênh</CardTitle>
            </div>
            <CardDescription>Tên hiển thị và mô tả ngắn (mẫu).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">Tên kênh</label>
              <Input placeholder="VD: NexEdu — Lập trình Web" className="rounded-xl" disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">Giới thiệu kênh</label>
              <Input placeholder="Mô tả ngắn về nội dung bạn giảng dạy..." className="rounded-xl" disabled />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              <CardTitle className="text-lg">Thanh toán</CardTitle>
            </div>
            <CardDescription>Cấu hình nhận thanh toán (placeholder).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
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
              <Bell className="size-5 text-primary" />
              <CardTitle className="text-lg">Thông báo</CardTitle>
            </div>
            <CardDescription>Email khi có đăng ký mới hoặc bình luận (mẫu).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Chưa có tùy chọn — giao diện giữ chỗ.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
