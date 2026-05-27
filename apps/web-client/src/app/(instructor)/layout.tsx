'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  Settings,
  UserCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QaNavItem } from '@/components/instructor/qa-nav-item';
import { useAppSelector } from '@/lib/redux/hooks';

interface NavLink {
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  links: NavLink[];
  includeQa?: boolean;
}

const navGroups: NavGroup[] = [
  {
    title: 'Tổng quan',
    links: [
      { label: 'Bảng điều khiển', description: 'Việc cần làm hôm nay', href: '/instructor', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Nội dung khóa học',
    links: [
      { label: 'Khóa học', description: 'Tạo, sửa và xuất bản', href: '/instructor/courses', icon: BookOpen },
      { label: 'Chứng chỉ', description: 'Mẫu cấp sau hoàn thành', href: '/instructor/certificates', icon: Award },
    ],
  },
  {
    title: 'Học viên & tương tác',
    links: [],
    includeQa: true,
  },
  {
    title: 'Doanh thu & thanh toán',
    links: [
      { label: 'Phân tích', description: 'Doanh thu và đơn hàng', href: '/instructor/analytics', icon: BarChart3 },
      { label: 'Kênh thanh toán', description: 'Số dư, ngân hàng, rút tiền', href: '/instructor/settings', icon: Settings },
    ],
  },
  {
    title: 'Hồ sơ giảng viên',
    links: [
      { label: 'Hồ sơ công khai', description: 'Tên, bio, avatar, liên kết', href: '/instructor/profile', icon: UserCircle },
    ],
  },
];

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function isLinkActive(pathname: string, href: string) {
  const path = normalizePath(pathname);
  const normalizedHref = normalizePath(href);
  if (normalizedHref === '/instructor') return path === '/instructor';
  return path === normalizedHref || path.startsWith(`${normalizedHref}/`);
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

  if (!mounted || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground">Đang tải Instructor Studio...</p>
      </div>
    );
  }

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
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(event) => event.key === 'Escape' && setMobileOpen(false)}
        />
      )}

      <aside
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-[19rem] border-r border-white/50 transition-transform duration-200 md:sticky md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onKeyDown={(event) => event.key === 'Escape' && setMobileOpen(false)}
      >
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain p-5 pt-20 [scrollbar-width:thin] md:pt-6">
          <Link href="/" className="mb-6 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={32} height={32} />
            <span className="token-section-title">NexEdu Studio</span>
          </Link>

          <div className="mb-2 space-y-4">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.links.map((link) => {
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
                  {group.includeQa && <QaNavItem />}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-4 border-t border-white/20 pt-4">
            <Button variant="outline" className="w-full justify-start gap-2 text-sm font-semibold" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="size-4" /> Thoát Studio
            </Button>
            <div className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/25 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
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

      <main className="min-h-screen flex-1 overflow-x-hidden pb-20 pt-16 md:pt-0">
        <div className="workspace-shell">{children}</div>
      </main>
    </div>
  );
}
