'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Tổng quan', href: '/dashboard' },
  { label: 'Khóa học của tôi', href: '/dashboard/courses' },
  { label: 'Chứng chỉ', href: '/dashboard/certificates' },
  { label: 'Cộng đồng', href: '/dashboard/community' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="relative z-30 border-b border-white/40 bg-white/40 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-2.5 text-sm font-semibold text-muted-foreground md:justify-start md:px-8">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? 'border-b-2 border-primary pb-0.5 text-primary'
                  : 'pb-0.5 transition-colors hover:text-primary'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
