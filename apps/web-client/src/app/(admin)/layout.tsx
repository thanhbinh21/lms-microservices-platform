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
  MessageSquare,
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
  description: string;
  href: string;
  aliases?: string[];
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Tổng quan',
    links: [
      {
        label: 'Bảng điều khiển',
        description: 'Chỉ số vận hành và việc cần xử lý',
        href: '/admin',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Người dùng & giảng viên',
    links: [
      { label: 'Người dùng', description: 'Vai trò, trạng thái, tài khoản', href: '/admin/users', icon: Users },
      {
        label: 'Đơn giảng viên',
        description: 'Duyệt hồ sơ trở thành giảng viên',
        href: '/admin/instructor-requests',
        icon: GraduationCap,
      },
      { label: 'Hỗ trợ', description: 'Ticket từ học viên và giảng viên', href: '/admin/support', icon: Headphones },
    ],
  },
  {
    label: 'Nội dung học tập',
    links: [
      { label: 'Khóa học', description: 'Duyệt, lưu trữ, mở lại khóa học', href: '/admin/courses', icon: BookOpen },
      { label: 'Danh mục', description: 'Nhóm chủ đề và thứ tự hiển thị', href: '/admin/categories', icon: Shapes },
      { label: 'Đánh giá', description: 'Gắn cờ và xử lý review vi phạm', href: '/admin/reviews', icon: Star },
      { label: 'Cộng đồng', description: 'Theo dõi bài viết và tương tác', href: '/admin/community', icon: MessageSquare },
    ],
  },
  {
    label: 'Thanh toán & doanh thu',
    links: [
      { label: 'Rút tiền', description: 'Duyệt hoặc từ chối payout', href: '/admin/payouts', icon: Wallet },
      { label: 'Doanh thu', description: 'GMV, phí nền tảng, top khóa học', href: '/admin/revenue', icon: BarChart3 },
    ],
  },
  {
    label: 'Vận hành hệ thống',
    links: [
      {
        label: 'Cấu hình',
        description: 'Phí, payout, thanh toán, bảo mật',
        href: '/admin/settings',
        aliases: ['/admin/system-config'],
        icon: Settings2,
      },
      {
        label: 'Thông báo',
        description: 'Lịch sử thông báo hệ thống',
        href: '/admin/notifications',
        icon: Bell,
      },
    ],
  },
  {
    label: 'Nhật ký & lỗi',
    links: [
      {
        label: 'Audit log',
        description: 'Dấu vết thao tác nhạy cảm',
        href: '/admin/audit-log',
        icon: ClipboardList,
      },
      {
        label: 'DLQ',
        description: 'Retry hoặc resolve sự kiện lỗi',
        href: '/admin/dlq',
        aliases: ['/admin/system'],
        icon: AlertTriangle,
      },
    ],
  },
];

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function isLinkActive(pathname: string, link: NavLink) {
  const path = normalizePath(pathname);
  const paths = [link.href, ...(link.aliases ?? [])].map(normalizePath);
  return paths.some((href) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`)));
}

function AdminNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav
      className="flex-1 space-y-5 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent]"
      aria-label="Điều hướng quản trị"
    >
      {navGroups.map((group) => (
        <section key={group.label} className="space-y-1.5">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          {group.links.map((link) => {
            const active = isLinkActive(pathname, link);
            return (
              <Link key={link.href} href={link.href} onClick={onNavigate}>
                <div
                  className={`group flex gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/15'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <link.icon className="mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{link.label}</p>
                    <p className={`line-clamp-1 text-xs ${active ? 'text-primary/75' : 'text-muted-foreground'}`}>
                      {link.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`glass-panel fixed left-0 top-0 z-40 h-screen w-[19rem] border-r border-white/50 transition-transform duration-200 md:sticky md:w-72 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-5 pt-20 md:pt-5">
          <Link href="/" className="mb-6 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={32} height={32} />
            <div className="min-w-0">
              <p className="truncate text-base font-bold">NexEdu Admin</p>
              <p className="text-xs text-muted-foreground">Bảng vận hành LMS</p>
            </div>
          </Link>

          <AdminNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />

          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <Button variant="outline" className="w-full justify-start gap-2 font-bold" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="size-4" /> Thoát Admin
            </Button>
            <div className="flex items-center gap-3 rounded-xl bg-white/40 p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                {user.name?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user.name}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{user.role}</p>
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
