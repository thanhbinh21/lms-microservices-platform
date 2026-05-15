'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Award, BookOpen, Headphones, LayoutDashboard, Menu, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TabId = 'overview' | 'my-courses' | 'certificates' | 'qa' | 'support';

const TABS: { id: TabId; label: string; href: string }[] = [
  { id: 'overview', label: 'Tổng quan', href: '/dashboard/overview' },
  { id: 'my-courses', label: 'Khóa học của tôi', href: '/dashboard/courses' },
  { id: 'certificates', label: 'Chứng chỉ', href: '/dashboard/certificates' },
  { id: 'qa', label: 'Hỏi đáp', href: '/dashboard/qa' },
  { id: 'support', label: 'Hỗ trợ', href: '/dashboard/support' },
];

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  'my-courses': BookOpen,
  certificates: Award,
  qa: MessageSquare,
  support: Headphones,
};

interface DashboardNavProps {
  activeTab?: TabId;
}

export function DashboardNav({ activeTab }: DashboardNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentTab = TABS.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  const current = activeTab ?? currentTab?.id;

  return (
    <>
      <div className="glass-navbar fixed top-0 z-40 flex w-full items-center justify-between px-4 py-3 md:hidden">
        <Link href="/" className="text-sm font-bold">NexEdu Dashboard</Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((prev) => !prev)} aria-label="Mở menu dashboard">
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
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-72 border-r border-white/50 transition-transform duration-200 md:sticky md:w-64 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-6 pt-20 md:pt-6">
          <h2 className="mb-5 text-lg font-bold">Bảng điều khiển học viên</h2>

          <nav className="space-y-1" aria-label="Điều hướng dashboard">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              const isActive = current === tab.id || pathname === tab.href;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    router.push(tab.href);
                    setMobileOpen(false);
                  }}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isActive
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-transparent hover:bg-white/40'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="size-4" />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => router.push('/')}>
              <ArrowLeft className="size-4" /> Về trang chủ
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
