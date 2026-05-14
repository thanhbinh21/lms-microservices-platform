'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Menu,
  Settings2,
  Shapes,
  Star,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';

interface NavLink {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const navLinks: NavLink[] = [
  { label: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
  { label: 'Người dùng', href: '/admin/users', icon: Users },
  { label: 'Khóa học', href: '/admin/courses', icon: BookOpen },
  { label: 'Danh mục', href: '/admin/categories', icon: Shapes },
  { label: 'Đánh giá', href: '/admin/reviews', icon: Star },
  { label: 'Đơn giảng viên', href: '/admin/instructor-requests', icon: GraduationCap },
  { label: 'Hỗ trợ', href: '/admin/support', icon: Headphones },
  { label: 'Rút tiền', href: '/admin/payouts', icon: Wallet },
  { label: 'Doanh thu', href: '/admin/revenue', icon: BarChart3 },
  { label: 'Lịch sử thông báo', href: '/admin/notifications', icon: Bell },
  { label: 'Cấu hình hệ thống', href: '/admin/system-config', icon: Settings2 },
  { label: 'Audit log', href: '/admin/audit-log', icon: ClipboardList },
  { label: 'DLQ hệ thống', href: '/admin/system', icon: AlertTriangle },
];

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function isLinkActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const normalizedHref = normalizePath(href);
  if (normalizedHref === '/admin') return path === '/admin';
  return path === normalizedHref || path.startsWith(`${normalizedHref}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, isAuthenticated, isLoading, router]);

  if (!mounted || isLoading || !user) return null;
  if (user.role !== 'ADMIN') return null;

  return (
    <div className="glass-page flex min-h-screen text-foreground">
      <div className="glass-navbar fixed top-0 z-40 flex w-full items-center justify-between px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={28} height={28} />
          <span className="text-sm font-bold">NexEdu Admin</span>
        </Link>
        <Button variant="ghost" size="icon" aria-label="Mở menu quản trị" onClick={() => setMobileOpen((prev) => !prev)}>
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-72 border-r border-white/50 transition-transform duration-200 md:sticky md:w-64 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col p-6 pt-20 md:pt-6">
          <Link href="/" className="mb-8 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={32} height={32} />
            <span className="token-section-title">NexEdu Admin</span>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Điều hướng quản trị">
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
                    aria-current={active ? 'page' : undefined}
                  >
                    <link.icon className="size-5" />
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <Button variant="outline" className="w-full justify-start gap-2 font-bold" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="size-4" /> Thoát Admin
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                {user.name?.charAt(0) || 'A'}
              </div>
              <div className="overflow-hidden">
                <p className="truncate text-sm font-bold">{user.name}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen flex-1 overflow-x-hidden pb-20 pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}
