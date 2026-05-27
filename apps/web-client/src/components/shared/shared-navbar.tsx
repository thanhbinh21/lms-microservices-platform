'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Clapperboard,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { logout } from '@/lib/redux/authSlice';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { cn } from '@/lib/utils';
import { NotificationBell } from './notification-bell';

const navItems = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Khóa học', href: '/courses' },
  { label: 'Giảng viên', href: '/instructors' },
  { label: 'Cộng đồng', href: '/community' },
  { label: 'Hỗ trợ', href: '/support' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role?: string) {
  switch ((role || '').toUpperCase()) {
    case 'ADMIN':
      return 'Quản trị viên';
    case 'INSTRUCTOR':
      return 'Giảng viên';
    case 'STUDENT':
    default:
      return 'Học viên';
  }
}

export function SharedNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Tránh hydration mismatch bằng cách chỉ render role-aware menu sau khi component đã mount trên client.
  useEffect(() => {
    setMounted(true);
  }, []);

  const showRoleAware = mounted && isAuthenticated && user;

  const normalizedRole = (user?.role || '').toUpperCase();
  const primaryHref = normalizedRole === 'ADMIN' ? '/admin' : normalizedRole === 'INSTRUCTOR' ? '/instructor' : '/dashboard';
  const primaryLabel = normalizedRole === 'ADMIN' ? 'Admin' : normalizedRole === 'INSTRUCTOR' ? 'Studio' : 'Dashboard';
  const PrimaryIcon = normalizedRole === 'INSTRUCTOR' ? Clapperboard : LayoutDashboard;

  const accountLinks = useMemo(() => {
    const links = [
      { label: primaryLabel, href: primaryHref, icon: PrimaryIcon },
      { label: 'Hồ sơ & cài đặt', href: '/settings', icon: Settings },
    ];
    if (normalizedRole === 'STUDENT') {
      links.splice(1, 0, { label: 'Khóa học của tôi', href: '/dashboard/courses', icon: BookOpen });
      links.push({ label: 'Trở thành giảng viên', href: '/become-instructor', icon: GraduationCap });
    }
    if (normalizedRole === 'ADMIN') {
      links.push({ label: 'Quản trị hệ thống', href: '/admin/system', icon: ShieldCheck });
    }
    return links;
  }, [PrimaryIcon, normalizedRole, primaryHref, primaryLabel]);

  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeMobileMenu, mobileOpen]);

  const handleLogout = async () => {
    await logoutAction();
    dispatch(logout());
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="glass-navbar sticky top-0 z-40 shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Về trang chủ NexEdu">
          <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={40} height={40} priority />
          <span className="text-xl font-bold tracking-tight">NexEdu</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-1 py-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isActive(pathname, item.href) && 'text-primary',
              )}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {showRoleAware ? (
            <>
              <Button asChild variant="ghost" className="gap-2 rounded-xl font-semibold hover:bg-primary/10">
                <Link href={primaryHref}>
                  <PrimaryIcon className="size-4" />
                  {primaryLabel}
                </Link>
              </Button>
              <NotificationBell />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 rounded-full pl-2 pr-3 hover:bg-white/70" aria-label="Mở menu tài khoản">
                    {user.avatar ? (
                      <span className="relative size-8 overflow-hidden rounded-full border border-primary/20 bg-primary/10">
                        <Image src={user.avatar} alt={user.name || 'Ảnh đại diện'} width={32} height={32} className="size-full object-cover" />
                      </span>
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                        {user.name?.charAt(0) || 'U'}
                      </span>
                    )}
                    <span className="max-w-36 truncate text-sm font-semibold">{user.name}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 rounded-xl p-2">
                  <div className="px-2 py-2">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {roleLabel(user.role)}
                    </p>
                  </div>
                  <div className="my-1 h-px bg-border/70" />
                  <div className="space-y-1">
                    {accountLinks.map((item) => (
                      <Button key={item.href} asChild variant="ghost" className="h-9 w-full justify-start gap-2 rounded-lg px-2 font-medium">
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          {item.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                  <div className="my-1 h-px bg-border/70" />
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-full justify-start gap-2 rounded-lg px-2 font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    Đăng xuất
                  </Button>
                </PopoverContent>
              </Popover>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="font-semibold">
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild className="font-semibold shadow-md shadow-primary/20">
                <Link href="/register">Đăng ký</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {mounted && isAuthenticated ? <NotificationBell /> : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="glass-panel border-t border-white/50 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground',
                  isActive(pathname, item.href) && 'bg-primary/10 text-primary',
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {showRoleAware ? (
              <>
                {accountLinks.map((item) => (
                  <Button key={item.href} asChild variant="outline" className="w-full justify-start gap-2 rounded-xl bg-white/70 font-semibold">
                    <Link href={item.href} onClick={closeMobileMenu}>
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-red-600"
                  onClick={async () => {
                    closeMobileMenu();
                    await handleLogout();
                  }}
                >
                  <LogOut className="size-4" />
                  Đăng xuất
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="w-full rounded-xl bg-white/70">
                  <Link href="/login" onClick={closeMobileMenu}>Đăng nhập</Link>
                </Button>
                <Button asChild className="w-full rounded-xl">
                  <Link href="/register" onClick={closeMobileMenu}>Đăng ký</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
