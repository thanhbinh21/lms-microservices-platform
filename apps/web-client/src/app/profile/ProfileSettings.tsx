'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Settings,
  User,
  Bell,
  Shield,
  Wallet,
  LogOut,
  Camera,
  Loader2,
  CheckCircle2,
  ClipboardList,
  Clapperboard,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { logout } from '@/lib/redux/authSlice';
import { AdminInstructorRequestsPanel } from '@/components/admin/AdminInstructorRequestsPanel';

type TabId = 'personal' | 'security' | 'notifications' | 'payments' | 'display' | 'instructor-requests';

function roleLabelVi(role: string): string {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return 'Quản trị viên';
    case 'INSTRUCTOR':
      return 'Giảng viên';
    case 'STUDENT':
    default:
      return 'Học viên';
  }
}

export function ProfileSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';
  const canAccessInstructorStudio = normalizedRole === 'INSTRUCTOR' || normalizedRole === 'ADMIN';

  const tabParam = searchParams.get('tab') as TabId | null;
  const requestId = searchParams.get('requestId');

  const activeTab: TabId = useMemo(() => {
    const t = tabParam || 'personal';
    if (t === 'instructor-requests' && !isAdmin) return 'personal';
    if (
      t === 'personal' ||
      t === 'security' ||
      t === 'notifications' ||
      t === 'payments' ||
      t === 'display' ||
      t === 'instructor-requests'
    ) {
      return t;
    }
    return 'personal';
  }, [tabParam, isAdmin]);

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (tabParam === 'instructor-requests' && !isAdmin) {
      router.replace('/profile?tab=personal');
    }
  }, [tabParam, isAdmin, router]);

  const handleLogout = async () => {
    await logoutAction();
    dispatch(logout());
    router.push('/login');
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  const goToTab = (tab: TabId, opts?: { requestId?: string | null }) => {
    const p = new URLSearchParams();
    p.set('tab', tab);
    if (opts?.requestId) {
      p.set('requestId', opts.requestId);
    }
    router.replace(`/profile?${p.toString()}`);
  };

  const openRequestDetail = (id: string) => {
    goToTab('instructor-requests', { requestId: id });
  };

  const backToRequestList = () => {
    goToTab('instructor-requests');
  };

  const sidebarItems = useMemo(() => {
    const base: { id: TabId; label: string; icon: typeof User }[] = [
      { id: 'personal', label: 'Hồ sơ cá nhân', icon: User },
      { id: 'security', label: 'Bảo mật & Mật khẩu', icon: Shield },
      { id: 'notifications', label: 'Thông báo', icon: Bell },
      { id: 'payments', label: 'Lịch sử thanh toán', icon: Wallet },
      { id: 'display', label: 'Tùy chọn hiển thị', icon: Settings },
    ];
    if (!isAdmin) return base;
    const adminEntry = { id: 'instructor-requests' as const, label: 'Quản lý đơn GV', icon: ClipboardList };
    return [base[0], adminEntry, ...base.slice(1)];
  }, [isAdmin]);

  if (!user) return null;

  return (
    <div className="glass-page relative min-h-screen overflow-hidden pb-12 text-foreground">
      <div className="pointer-events-none absolute right-[-5%] top-[-10%] h-[50%] w-[50%] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-5%] h-[40%] w-[40%] rounded-full bg-blue-300/15 blur-[100px]" />

      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/50 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={40} height={40} priority />
            <span className="text-xl font-bold tracking-tight">NexEdu</span>
          </Link>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="max-md:hidden font-semibold text-muted-foreground hover:text-primary"
              onClick={() => router.push('/dashboard')}
            >
              Quay lại Dashboard
            </Button>
            <div className="flex size-10 cursor-default items-center justify-center rounded-full border-2 border-white bg-primary/10 text-lg font-bold text-primary shadow-sm">
              {user.name?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
        <ScrollReveal>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Cài Đặt Tài Khoản</h1>
            <p className="mt-1 font-medium text-muted-foreground">
              Quản lý thông tin thanh toán, bảo mật và tùy chọn cá nhân hóa.
              {isAdmin && ' Admin có thể duyệt đơn đăng ký giảng viên trong tab Quản lý đơn GV.'}
            </p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col gap-8 md:flex-row">
          <ScrollReveal delay={100} className="w-full shrink-0 space-y-2 md:w-72">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goToTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-all ${
                  activeTab === item.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
                    : 'text-muted-foreground hover:bg-white/60 hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}

            <div className="mt-4 border-t border-border/50 pt-6">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Đăng xuất tài khoản
              </button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150} className="min-w-0 flex-1">
            {activeTab === 'instructor-requests' && isAdmin ? (
              <AdminInstructorRequestsPanel
                requestId={requestId}
                onOpenDetail={openRequestDetail}
                onBackToList={backToRequestList}
              />
            ) : activeTab === 'personal' ? (
              <Card className="glass-panel relative overflow-hidden rounded-[2rem] border-white/60 shadow-xl">
                <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-bold">Thông tin Công khai</CardTitle>
                  <CardDescription className="text-base font-medium">
                    Thông tin này sẽ hiển thị trên tường lớp học và cộng đồng.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-8 p-8 pt-4">
                  <div className="flex items-center gap-6">
                    <div className="group relative cursor-pointer">
                      <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-primary to-indigo-500 text-4xl font-bold text-white shadow-xl">
                        {user.name?.charAt(0) || 'U'}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Camera className="h-8 w-8 text-white drop-shadow-md" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-bold text-foreground">Ảnh đại diện</p>
                      <div className="flex gap-3">
                        <Button
                          variant="secondary"
                          className="rounded-xl border border-white bg-white/80 font-bold shadow-sm hover:bg-white"
                        >
                          Tải ảnh lên
                        </Button>
                        <Button variant="ghost" className="font-bold text-muted-foreground">
                          Xóa
                        </Button>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">JPEG hoặc PNG không vượt quá 2MB.</p>
                    </div>
                  </div>

                  <div className="grid gap-6 pt-2 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-foreground">Vai trò</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
                          {roleLabelVi(user.role)}
                        </span>
                        {canAccessInstructorStudio && (
                          <Button asChild variant="outline" className="gap-2 rounded-xl border-primary/30 font-bold">
                            <Link href="/instructor">
                              <Clapperboard className="size-4 shrink-0" />
                              Vào Studio giảng viên
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Họ và Tên</label>
                      <Input
                        defaultValue={user.name}
                        className="h-12 rounded-xl border-white/80 bg-white/60 px-4 text-base font-medium shadow-sm backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Email Đăng nhập</label>
                      <Input
                        defaultValue={user.email}
                        readOnly
                        className="h-12 cursor-not-allowed rounded-xl border-white/80 bg-white/40 px-4 text-base font-medium text-muted-foreground shadow-sm backdrop-blur-sm focus-visible:ring-0"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-foreground">Thành phố / Khu vực</label>
                      <Input
                        placeholder="VD: TP. Hồ Chí Minh"
                        className="h-12 rounded-xl border-white/80 bg-white/60 px-4 text-base font-medium shadow-sm backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/40"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-foreground">Châm ngôn (Headline)</label>
                      <Input
                        placeholder="VD: Software / Devops Engineer"
                        className="h-12 rounded-xl border-white/80 bg-white/60 px-4 text-base font-medium shadow-sm backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/40"
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="mt-6 flex items-center justify-end gap-4 rounded-b-[2rem] border-t border-white/50 bg-white/10 p-8 pt-0">
                  {saved && (
                    <span className="animate-in fade-in zoom-in slide-in-from-right-4 flex items-center gap-1.5 text-sm font-bold text-emerald-600 duration-300">
                      <CheckCircle2 className="h-5 w-5" /> Đã lưu thành công
                    </span>
                  )}
                  <Button variant="ghost" className="mt-6 rounded-xl font-bold hover:bg-white/60">
                    Hủy
                  </Button>
                  <Button className="mt-6 rounded-xl px-8 font-bold shadow-md" onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lưu thay đổi
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card className="glass-panel rounded-[2rem] border-white/60 shadow-xl">
                <CardHeader className="p-8">
                  <CardTitle className="text-xl font-bold">
                    {sidebarItems.find((s) => s.id === activeTab)?.label ?? 'Cài đặt'}
                  </CardTitle>
                  <CardDescription className="text-base font-medium">
                    Thông tin cho mục này đang được hoàn thiện. Vui lòng quay lại sau.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </ScrollReveal>
        </div>
      </main>
    </div>
  );
}
