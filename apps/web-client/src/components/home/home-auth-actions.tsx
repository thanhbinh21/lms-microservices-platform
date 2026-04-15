'use client';

import Link from 'next/link';
import { ArrowRight, Clapperboard, LayoutDashboard, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';
import { useEffect, useState } from 'react';

interface HomeAuthActionsProps {
  context: 'hero' | 'cta';
}

export function HomeAuthActions({ context }: HomeAuthActionsProps) {
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tranh hydration mismatch: server va client render giong nhau (null) cho den khi mount
  if (!mounted || isLoading) {
    return null;
  }

  const normalizedRole = (user?.role || '').toUpperCase();
  const canAccessInstructorStudio = normalizedRole === 'INSTRUCTOR' || normalizedRole === 'ADMIN';

  if (!isAuthenticated || !user) {
    if (context === 'hero') {
      return (
        <>
          <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/20">
            <Link href="/register">
              Bắt đầu ngay
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 bg-white/60">
            <Link href="/login">
              <PlayCircle className="size-4" />
              Xem demo
            </Link>
          </Button>
        </>
      );
    }

    return (
      <>
        <Button asChild variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8 shadow-xl">
          <Link href="/register">Đăng ký miễn phí</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-white/40 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 hover:text-white">
          <Link href="/login">Liên hệ tư vấn</Link>
        </Button>
      </>
    );
  }

  if (context === 'hero') {
    return (
      <>
        <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/20">
          <Link href={canAccessInstructorStudio ? '/instructor' : '/dashboard'}>
            {canAccessInstructorStudio ? 'Vào Studio' : 'Vào Dashboard'}
            {canAccessInstructorStudio ? <Clapperboard className="size-4" /> : <LayoutDashboard className="size-4" />}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2 bg-white/60">
          <Link href="/courses">
            <PlayCircle className="size-4" />
            Khám phá khóa học
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button asChild variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8 shadow-xl">
        <Link href={canAccessInstructorStudio ? '/instructor' : '/dashboard'}>
          {canAccessInstructorStudio ? 'Vào Studio giảng viên' : 'Mở Dashboard'}
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-white/40 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 hover:text-white">
        <Link href="/courses">Xem khóa học đã xuất bản</Link>
      </Button>
    </>
  );
}
