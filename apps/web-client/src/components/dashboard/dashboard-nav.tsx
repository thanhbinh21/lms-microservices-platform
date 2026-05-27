'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ComponentType } from 'react';
import { ArrowLeft, Award, BookOpen, Headphones, LayoutDashboard, Menu, MessageSquare, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TabId = 'overview' | 'my-courses' | 'certificates' | 'orders' | 'qa' | 'support';

interface NavItem {
  id: TabId;
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Tổng quan',
    items: [
      { id: 'overview', label: 'Bảng điều khiển', description: 'Tiến độ và việc học gần đây', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Học tập',
    items: [
      { id: 'my-courses', label: 'Khóa học của tôi', description: 'Tiếp tục học và xem tiến độ', href: '/dashboard/courses', icon: BookOpen },
      { id: 'certificates', label: 'Chứng chỉ', description: 'Chứng chỉ đã nhận', href: '/dashboard/certificates', icon: Award },
      { id: 'qa', label: 'Hỏi đáp', description: 'Câu hỏi theo khóa học', href: '/dashboard/qa', icon: MessageSquare },
    ],
  },
  {
    title: 'Tài khoản',
    items: [
      { id: 'orders', label: 'Lịch sử đơn hàng', description: 'VNPay và vào học sau thanh toán', href: '/dashboard/orders', icon: Wallet },
      { id: 'support', label: 'Hỗ trợ', description: 'Ticket với admin', href: '/dashboard/support', icon: Headphones },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/dashboard/overview';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface DashboardNavProps {
  activeTab?: TabId;
}

export function DashboardNav({ activeTab }: DashboardNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="glass-navbar fixed top-0 z-40 flex w-full items-center justify-between px-4 py-3 md:hidden">
        <Link href="/dashboard" className="text-sm font-bold">NexEdu Dashboard</Link>
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
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-[19rem] border-r border-white/50 transition-transform duration-200 md:sticky md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain p-5 pt-20 [scrollbar-width:thin] md:pt-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold">Dashboard học viên</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Theo dõi học tập, đơn hàng và hỗ trợ trong một nơi.</p>
          </div>

          <nav className="space-y-4" aria-label="Điều hướng dashboard">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id || isActivePath(pathname, item.href);
                    return (
                      <Link key={item.id} href={item.href} onClick={() => setMobileOpen(false)}>
                        <div
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
                            isActive
                              ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
                              : 'border-transparent bg-transparent text-muted-foreground hover:border-white/30 hover:bg-white/30 hover:text-foreground'
                          }`}
                        >
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-primary/15' : 'bg-black/5'}`}>
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold">{item.label}</span>
                            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-muted-foreground">{item.description}</span>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/20 pt-4">
            <Button variant="outline" className="w-full justify-start gap-2 text-sm font-semibold" onClick={() => router.push('/')}>
              <ArrowLeft className="size-4" /> Về trang chủ
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
