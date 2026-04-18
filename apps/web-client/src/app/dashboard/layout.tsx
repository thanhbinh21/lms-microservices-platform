'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';

/**
 * Guard toan bo /dashboard/*:
 * - Chua dang nhap -> /login
 * - Role INSTRUCTOR -> redirect ve trang chu (giang vien dung Studio).
 * - Role ADMIN -> redirect ve trang chu (admin dung Profile > Quan ly don GV).
 * - Chi STUDENT moi duoc vao.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  const normalizedRole = (user?.role || '').toUpperCase();
  const isBlockedRole = normalizedRole === 'INSTRUCTOR' || normalizedRole === 'ADMIN';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isBlockedRole) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, isBlockedRole, router]);

  if (isLoading || !isAuthenticated || isBlockedRole) {
    return (
      <div className="glass-page flex min-h-screen items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
