'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, BookOpen, Users, Award,
  BarChart3, Settings, ArrowLeft, Menu, X, UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavLink {
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const navLinks: NavLink[] = [
  { label: 'Tổng quan', description: 'Xem nhanh trạng thái studio', href: '/instructor', icon: LayoutDashboard },
  { label: 'Khóa học', description: 'Tạo và quản lý nội dung', href: '/instructor/courses', icon: BookOpen },
  { label: 'Cộng đồng', description: 'Nhóm thảo luận cho học viên', href: '/instructor/communities', icon: Users },
  { label: 'Chứng chỉ', description: 'Mẫu chứng chỉ hoàn thành', href: '/instructor/certificates', icon: Award },
  { label: 'Phân tích', description: 'Theo dõi doanh thu và tăng trưởng', href: '/instructor/analytics', icon: BarChart3 },
  { label: 'Thanh toán', description: 'Doanh thu và nhận tiền', href: '/instructor/settings', icon: Settings },
  { label: 'Kênh của tôi', description: 'Cấu hình hồ sơ công khai', href: '/instructor/profile', icon: UserCircle },
];

function normalizePath(p: string) {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

function isLinkActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const h = normalizePath(href);
  if (h === '/instructor') {
    return path === '/instructor';
  }
  return path === h || path.startsWith(`${h}/`);
}

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.role === 'ADMIN') {
      router.replace('/');
    } else if (user?.role !== 'INSTRUCTOR') {
      router.replace('/dashboard');
    }
  }, [user, isAuthenticated, isLoading, router]);

  if (!mounted || isLoading || !user) return null;

  if (user.role !== 'INSTRUCTOR') {
    return null;
  }

  return (
    <div className="glass-page flex min-h-screen text-foreground">
      {/* Mobile top bar */}
      <div className="glass-navbar fixed top-0 z-40 flex w-full items-center justify-between px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={28} height={28} />
          <span className="text-sm font-bold">NexEdu Studio</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mở menu giảng viên"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-72 border-r border-white/50 transition-transform duration-200 md:sticky md:w-68 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
      >
        <div className="flex h-full flex-col overflow-y-auto p-6 pt-20 md:pt-6">
          <Link href="/" className="mb-6 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={32} height={32} />
            <span className="token-section-title">NexEdu Studio</span>
          </Link>

          <div className="mb-2">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Menu chính
            </p>
            <div className="space-y-1">
              {navLinks.map((link) => {
                const active = isLinkActive(pathname, link.href);
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                    <div
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
                        active
                          ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
                          : 'border-transparent bg-transparent text-muted-foreground hover:border-white/30 hover:bg-white/30 hover:text-foreground'
                      }`}
                    >
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary/15' : 'bg-black/5'}`}>
                        <link.icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold">{link.label}</span>
                        <span className="mt-0.5 block text-[11px] font-normal leading-tight text-muted-foreground">{link.description}</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-auto space-y-4 border-t border-white/20 pt-4">
            <Button variant="outline" className="w-full justify-start gap-2 text-sm font-semibold" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="size-4" /> Thoát Studio
            </Button>
            <div className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/25 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary text-sm">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-[13px] font-bold">{user.name}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen flex-1 overflow-x-hidden pb-20 pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}
