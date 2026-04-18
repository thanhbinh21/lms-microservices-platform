'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, BarChart, Settings, ArrowLeft, Menu, X, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavLink {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const navLinks: NavLink[] = [
  { label: 'Tổng quan', href: '/instructor', icon: LayoutDashboard },
  { label: 'Quản lý khóa học', href: '/instructor/courses', icon: BookOpen },
  { label: 'Phân tích & Doanh thu', href: '/instructor/analytics', icon: BarChart },
  { label: 'Thiết lập Kênh', href: '/instructor/settings', icon: Settings },
];

function normalizePath(p: string) {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

function isLinkActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const h = normalizePath(href);
  // Trang gốc /instructor: chỉ active đúng khi đang ở đúng URL đó (không gồm /instructor/courses, ...)
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

    // Role Guard: chi INSTRUCTOR moi duoc vao Studio.
    // - Chua dang nhap -> /login
    // - ADMIN -> trang chu (admin quan ly qua Profile > Quan ly don GV, khong phai Studio)
    // - STUDENT -> /dashboard
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.role === 'ADMIN') {
      router.replace('/');
    } else if (user?.role !== 'INSTRUCTOR') {
      router.replace('/dashboard');
    }
  }, [user, isAuthenticated, isLoading, router]);

  if (!mounted || isLoading || !user) return null; // Wait for client hydration

  // Chan render con khi sai role de tranh flicker truoc khi redirect xu ly xong
  if (user.role !== 'INSTRUCTOR') {
    return null;
  }

  return (
    <div className="glass-page flex min-h-screen text-foreground">
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
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-72 border-r border-white/50 transition-transform duration-200 md:sticky md:w-64 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 pt-20 md:pt-6">
          <Link href="/" className="mb-8 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={32} height={32} />
            <span className="token-section-title">NexEdu Studio</span>
          </Link>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <div
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <link.icon className="size-5" />
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-auto space-y-4 border-t border-border p-6">
          <Button variant="outline" className="w-full justify-start gap-2 font-bold" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="size-4" /> Thoát Studio
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar */}
      {/* Main Content Area */}
      <main className="min-h-screen flex-1 overflow-x-hidden pb-20 pt-16 md:pt-0">
         {children}
      </main>
    </div>
  );
}
