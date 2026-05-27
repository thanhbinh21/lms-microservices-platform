'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Eye, EyeOff, Loader2, Shield, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicPageHeader, PublicPageShell } from '@/components/shared/public-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppSelector } from '@/lib/redux/hooks';
import { cn } from '@/lib/utils';

type TabId = 'profile' | 'security' | 'notifications';

const tabs: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Hồ sơ', icon: User },
  { id: 'security', label: 'Bảo mật', icon: Shield },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeTab = useMemo<TabId>(() => {
    const value = searchParams.get('tab');
    return value === 'security' || value === 'notifications' || value === 'profile' ? value : 'profile';
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  const goToTab = (tab: TabId) => {
    router.replace(`/settings?tab=${tab}`);
  };

  if (isLoading || !user) {
    return (
      <PublicPageShell withFooter={false} mainClassName="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell withFooter={false} mainClassName="max-w-6xl space-y-8 py-10">
      <PublicPageHeader
        eyebrow="Tài khoản"
        title="Cài đặt cá nhân"
        description="Quản lý hồ sơ, bảo mật và tùy chọn thông báo cho tài khoản NexEdu."
        actions={
          <Button asChild variant="outline" className="rounded-xl bg-white/70 font-semibold">
            <Link href="/dashboard">Quay lại Dashboard</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="glass-panel h-fit rounded-2xl border-white/70 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => goToTab(tab.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors',
                activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
              )}
            >
              <tab.icon className="size-5" />
              {tab.label}
            </button>
          ))}
        </aside>

        <section>
          {activeTab === 'profile' ? (
            <Card className="glass-panel rounded-2xl border-white/70">
              <CardHeader>
                <CardTitle>Hồ sơ công khai</CardTitle>
                <p className="text-sm font-medium text-muted-foreground">Thông tin này được dùng trong cộng đồng, Q&A và hồ sơ học tập.</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-semibold">Họ và tên</label>
                    <Input id="name" defaultValue={user.name} className="h-11 rounded-xl bg-white/70" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-semibold">Email đăng nhập</label>
                    <Input id="email" defaultValue={user.email} readOnly className="h-11 rounded-xl bg-white/50 text-muted-foreground" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="headline" className="text-sm font-semibold">Giới thiệu ngắn</label>
                    <Input id="headline" placeholder="Ví dụ: Frontend Developer, học viên NexEdu" className="h-11 rounded-xl bg-white/70" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {saved ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" /> Đã lưu tạm thời</span> : null}
                  <Button className="rounded-xl font-semibold" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}>
                    Lưu thay đổi
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : activeTab === 'security' ? (
            <Card className="glass-panel rounded-2xl border-white/70">
              <CardHeader>
                <CardTitle>Bảo mật tài khoản</CardTitle>
                <p className="text-sm font-medium text-muted-foreground">Đổi mật khẩu sẽ được nối vào endpoint auth-service khi backend mở API này.</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="current-password" className="text-sm font-semibold">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Input id="current-password" type={showPassword ? 'text' : 'password'} placeholder="Nhập mật khẩu hiện tại" className="h-11 rounded-xl bg-white/70 pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9" onClick={() => setShowPassword((value) => !value)} aria-label="Ẩn hiện mật khẩu">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="text-sm font-semibold">Mật khẩu mới</label>
                    <Input id="new-password" type="password" placeholder="Tối thiểu 8 ký tự" className="h-11 rounded-xl bg-white/70" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-sm font-semibold">Xác nhận mật khẩu</label>
                    <Input id="confirm-password" type="password" placeholder="Nhập lại mật khẩu mới" className="h-11 rounded-xl bg-white/70" />
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                  Hiện tại UI đã sẵn sàng, backend đổi mật khẩu chưa được bật trong phase này.
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-panel rounded-2xl border-white/70">
              <CardHeader>
                <CardTitle>Tùy chọn thông báo</CardTitle>
                <p className="text-sm font-medium text-muted-foreground">Chọn loại thông báo bạn muốn ưu tiên trong Notification Bell và email.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['payment', 'Thanh toán và đơn hàng'],
                  ['learning', 'Tiến độ học tập và chứng chỉ'],
                  ['community', 'Cộng đồng, Q&A và phản hồi hỗ trợ'],
                ].map(([id, label]) => (
                  <label key={id} htmlFor={id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-semibold">
                    {label}
                    <input id={id} type="checkbox" defaultChecked className="size-4 accent-primary" />
                  </label>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </PublicPageShell>
  );
}
