'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <Link href="/login">
            <Button variant="ghost" className="font-bold">Đăng nhập</Button>
          </Link>
          <Link href="/register">
            <Button className="font-bold shadow-md shadow-primary/20">Đăng ký</Button>
          </Link>
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full">Đăng nhập</Button>
            </Link>
            <Link href="/register" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Đăng ký</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
