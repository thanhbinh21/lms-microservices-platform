'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clapperboard, LogOut, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/app/actions/auth';
import { logout } from '@/lib/redux/authSlice';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';

const navItems = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Khóa học', href: '/courses' },
  { label: 'Hỗ trợ', href: '/#ho-tro' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SharedNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    setMounted(true);
  }, []);

  const normalizedRole = (user?.role || '').toUpperCase();
  const canBecomeInstructor = isAuthenticated && normalizedRole === 'STUDENT';
  const canAccessInstructorStudio = isAuthenticated && normalizedRole === 'INSTRUCTOR';

  const handleLogout = async () => {
    await logoutAction();
    dispatch(logout());
    router.push('/login');
    router.refresh();
  };

  if (!mounted) {
    return <header className="glass-navbar sticky top-0 z-40 shadow-sm h-16"></header>;
  }

  return (
    <header className="glass-navbar sticky top-0 z-40 shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={40} height={40} priority />
          <span className="text-xl font-bold tracking-tight">NexEdu</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? 'border-b-2 border-primary pb-1 text-primary' : 'pb-1 transition-colors hover:text-primary'}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-white/50"
              >
                <span className="text-sm font-semibold text-foreground">Xin chào, {user!.name}</span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-primary/10 text-sm font-bold text-primary shadow-sm">
                  {user!.name?.charAt(0) || 'U'}
                </span>
              </Link>
              {canAccessInstructorStudio && (
                <Link href="/instructor">
                  <Button variant="outline" className="gap-2 border-primary/30 font-bold">
                    <Clapperboard className="size-4 shrink-0" />
                    Studio
                  </Button>
                </Link>
              )}
              {canBecomeInstructor && (
                <Link href="/become-instructor">
                  <Button className="font-bold shadow-md shadow-primary/20">Đăng ký làm Giảng viên</Button>
                </Link>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-transparent hover:text-primary"
                onClick={handleLogout}
                aria-label="Đăng xuất"
              >
                <LogOut className="size-5 shrink-0" />
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="font-bold">Đăng nhập</Button>
              </Link>
              <Link href="/register">
                <Button className="font-bold shadow-md shadow-primary/20">Đăng ký</Button>
              </Link>
            </>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Mở menu điều hướng"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="glass-panel md:hidden border-t border-white/50 px-4 py-4">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={isActive(pathname, item.href) ? 'rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary' : 'rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground'}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">Dashboard</Button>
                </Link>
                <Link href="/profile" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full font-bold">Hồ sơ & tài khoản</Button>
                </Link>
                {canAccessInstructorStudio && (
                  <Link href="/instructor" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full gap-2 border-primary/30 font-bold">
                      <Clapperboard className="size-4 shrink-0" />
                      Studio giảng viên
                    </Button>
                  </Link>
                )}
                {canBecomeInstructor && (
                  <Link href="/become-instructor" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full">Đăng ký GV</Button>
                  </Link>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="flex h-11 w-full items-center justify-center text-muted-foreground hover:bg-transparent hover:text-primary"
                  onClick={async () => {
                    setMobileOpen(false);
                    await handleLogout();
                  }}
                  aria-label="Đăng xuất"
                >
                  <LogOut className="size-5 shrink-0" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">Đăng nhập</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">Đăng ký</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
