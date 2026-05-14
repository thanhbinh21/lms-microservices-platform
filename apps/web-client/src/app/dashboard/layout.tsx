'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const normalizedRole = (user?.role || '').toUpperCase();
  const isBlockedRole = normalizedRole === 'INSTRUCTOR' || normalizedRole === 'ADMIN';

  useEffect(() => {
    if (!isMounted || isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isBlockedRole) {
      router.replace('/');
    }
  }, [isMounted, isAuthenticated, isLoading, isBlockedRole, router]);

  if (!isMounted || isLoading || !isAuthenticated || isBlockedRole) {
    return (
      <div className="glass-page flex min-h-screen items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass-page flex min-h-screen text-foreground">
      <DashboardNav />
      <main className="min-h-screen flex-1 overflow-x-hidden pb-20 pt-16 md:pt-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 space-y-6 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
