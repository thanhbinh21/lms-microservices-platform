'use client';

import { useAppSelector } from '@/lib/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, BarChart, Settings, List, PlusCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from 'lucide-react';

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Role Guard: Require authentication AND instructor/admin role
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.role !== 'INSTRUCTOR' && user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, isAuthenticated, router]);

  if (!mounted || !user) return null; // Wait for client hydration

  // If authenticated but wrong role, prevent rendering kids to avoid flicker before redirect catches
    if (user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
     return null;
  }

  const navLinks = [
    { label: 'Tổng quan', href: '/instructor', icon: LayoutDashboard },
    { label: 'Quản lý khóa học', href: '/instructor/courses', icon: BookOpen },
    { label: 'Phân tích & Doanh thu', href: '/instructor/analytics', icon: BarChart },
    { label: 'Thiết lập Kênh', href: '/instructor/settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-white/50 backdrop-blur-md hidden md:flex flex-col h-screen sticky top-0">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={32} height={32} />
            <span className="text-xl font-bold">NexEdu Studio</span>
          </Link>
          
          <div className="space-y-1">
             {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                     <link.icon className="size-5" />
                     {link.label}
                  </div>
                </Link>
             ))}
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-border space-y-4">
           <Button variant="outline" className="w-full gap-2 font-bold justify-start" onClick={() => router.push('/dashboard')}>
             <ArrowLeft className="size-4" /> Thoát Studio
           </Button>
           <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                 {user.name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{user.role}</p>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-h-screen pb-20 bg-slate-50/50">
         {children}
      </main>
    </div>
  );
}
