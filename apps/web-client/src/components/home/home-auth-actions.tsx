'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clapperboard, LayoutDashboard, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/redux/hooks';

interface HomeAuthActionsProps {
  context: 'hero' | 'cta';
}

export function HomeAuthActions({ context }: HomeAuthActionsProps) {
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const [mounted, setMounted] = useState(false);

  // Tránh hydration mismatch bằng cách chỉ render role-aware actions sau khi đã mount trên client.
  useEffect(() => {
    setMounted(true);
  }, []);

  const showRoleAware = mounted && !isLoading && isAuthenticated && user;

  const normalizedRole = (user?.role || '').toUpperCase();
  const workspaceHref = normalizedRole === 'ADMIN' ? '/admin' : normalizedRole === 'INSTRUCTOR' ? '/instructor' : '/dashboard';
  const workspaceLabel = normalizedRole === 'INSTRUCTOR' ? 'Vào Studio' : normalizedRole === 'ADMIN' ? 'Vào Admin' : 'Vào Dashboard';
  const WorkspaceIcon = normalizedRole === 'INSTRUCTOR' ? Clapperboard : LayoutDashboard;

  if (!showRoleAware) {
    return (
      <>
        <Button asChild size="lg" className="gap-2 rounded-xl font-semibold shadow-lg shadow-primary/20">
          <Link href="/register">
            Bắt đầu miễn phí
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl bg-white/70 font-semibold">
          <Link href={context === 'hero' ? '/courses' : '/support'}>
            <PlayCircle className="size-4" />
            {context === 'hero' ? 'Khám phá khóa học' : 'Nhận tư vấn'}
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button asChild size="lg" className="gap-2 rounded-xl font-semibold shadow-lg shadow-primary/20">
        <Link href={workspaceHref}>
          {workspaceLabel}
          <WorkspaceIcon className="size-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl bg-white/70 font-semibold">
        <Link href="/courses">
          <PlayCircle className="size-4" />
          Xem khóa học
        </Link>
      </Button>
    </>
  );
}
