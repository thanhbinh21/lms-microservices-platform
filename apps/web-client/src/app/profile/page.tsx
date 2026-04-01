'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Settings, User, Bell, Shield, Wallet, LogOut, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { useAppDispatch } from '@/lib/redux/hooks';
import { logout } from '@/lib/redux/authSlice';

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

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

  if (!user) return null;

  return (
    <div className="glass-page relative min-h-screen text-foreground overflow-hidden pb-12">
      {/* Background FX */}
      <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-300/15 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/50 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={40} height={40} priority />
            <span className="text-xl font-bold tracking-tight">NexEdu</span>
          </Link>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="font-semibold text-muted-foreground hover:text-primary max-md:hidden" onClick={() => router.push('/dashboard')}>
              Quay lại Dashboard
            </Button>
            <div className="size-10 rounded-full bg-primary/10 border-2 border-white shadow-sm flex items-center justify-center text-primary font-bold cursor-pointer">
              {user.name?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 relative z-10">
        
        <ScrollReveal>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Cài Đặt Tài Khoản</h1>
            <p className="text-muted-foreground font-medium mt-1">Quản lý thông tin thanh toán, bảo mật và tùy chọn cá nhân hóa.</p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Menu */}
          <ScrollReveal delay={100} className="w-full md:w-72 shrink-0 space-y-2">
            {[
              { label: 'Hồ sơ cá nhân', icon: User, active: true },
              { label: 'Bảo mật & Mật khẩu', icon: Shield },
              { label: 'Thông báo', icon: Bell },
              { label: 'Lịch sử thanh toán', icon: Wallet },
              { label: 'Tùy chọn hiển thị', icon: Settings },
            ].map((item, idx) => (
              <button 
                key={idx}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all ${
                  item.active 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90' 
                    : 'text-muted-foreground hover:bg-white/60 hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </button>
            ))}
            
            <div className="pt-6 border-t border-border/50 mt-4">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                Đăng xuất tài khoản
              </button>
            </div>
          </ScrollReveal>

          {/* Form Content */}
          <ScrollReveal delay={150} className="flex-1">
            <Card className="glass-panel border-white/60 rounded-[2rem] shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-2xl font-bold">Thông tin Công khai</CardTitle>
                <CardDescription className="text-base font-medium">
                  Thông tin này sẽ hiển thị trên tường lớp học và cộng đồng.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-8 pt-4 space-y-8">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                   <div className="relative group cursor-pointer">
                      <div className="size-28 rounded-full bg-gradient-to-br from-primary to-indigo-500 shadow-xl border-4 border-white flex items-center justify-center text-4xl font-bold text-white relative overflow-hidden">
                        {user.name?.charAt(0) || 'U'}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                      </div>
                   </div>
                   <div className="space-y-2">
                     <p className="font-bold text-foreground">Ảnh đại diện</p>
                     <div className="flex gap-3">
                        <Button variant="secondary" className="font-bold rounded-xl bg-white/80 hover:bg-white shadow-sm border border-white">
                          Tải ảnh lên
                        </Button>
                        <Button variant="ghost" className="font-bold text-muted-foreground">Xóa</Button>
                     </div>
                     <p className="text-xs text-muted-foreground font-medium">JPEG hoặc PNG không vượt quá 2MB.</p>
                   </div>
                </div>

                {/* Form Fields Section */}
                <div className="grid md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Họ và Tên</label>
                    <Input 
                      defaultValue={user.name} 
                      className="h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm font-medium px-4 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground">Email Đăng nhập</label>
                    <Input 
                      defaultValue={user.email} 
                      readOnly
                      className="h-12 rounded-xl bg-white/40 backdrop-blur-sm border-white/80 focus-visible:ring-0 shadow-sm font-medium px-4 text-base text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-foreground">Thành phố / Khu vực</label>
                    <Input 
                      placeholder="VD: TP. Hồ Chí Minh"
                      className="h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm font-medium px-4 text-base"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-foreground">Châm ngôn (Headline)</label>
                    <Input 
                      placeholder="VD: Software / Devops Engineer"
                      className="h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm font-medium px-4 text-base"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-8 pt-0 flex items-center justify-end gap-4 border-t border-white/50 bg-white/10 mt-6 rounded-b-[2rem]">
                {saved && (
                   <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 animate-in fade-in zoom-in slide-in-from-right-4 duration-300">
                     <CheckCircle2 className="w-5 h-5" /> Đã lưu thành công
                   </span>
                )}
                <Button variant="ghost" className="font-bold rounded-xl mt-6 hover:bg-white/60">Hủy</Button>
                <Button 
                  className="font-bold rounded-xl shadow-md px-8 mt-6" 
                  onClick={handleSave} 
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </CardFooter>
            </Card>
          </ScrollReveal>
        </div>

      </main>
    </div>
  );
}
