'use client';

import { MouseEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2, ShoppingCart } from 'lucide-react';
import type { DiscoveryCourse } from '@/app/actions/discovery';
import { getMyCoursesAction } from '@/app/actions/learning';
import { createOrderAction } from '@/app/actions/payment';
import { Button } from '@/components/ui/button';
import { PublicCourseCard } from '@/components/shared/public-course-card';
import { PublicState } from '@/components/shared/public-page';
import { useAppSelector } from '@/lib/redux/hooks';

interface CourseGridProps {
  courses: DiscoveryCourse[];
}

function CourseAction({ course, isEnrolled }: { course: DiscoveryCourse; isEnrolled: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const isFree = Number(course.price || 0) <= 0;

  const handleAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isEnrolled) {
      router.push(`/learn/${course.id}`);
      return;
    }
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isFree) {
      router.push(`/courses/${course.slug}`);
      return;
    }

    setBuying(true);
    setError('');
    const result = await createOrderAction(course.id);
    setBuying(false);

    if (result.success && result.data?.payUrl) {
      window.location.href = result.data.payUrl;
      return;
    }
    if (result.code === 409) {
      router.push(`/learn/${course.id}`);
      return;
    }
    setError(result.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={isEnrolled ? 'outline' : isFree ? 'secondary' : 'default'}
        className="h-9 gap-1.5 rounded-xl px-3 text-xs font-bold"
        disabled={buying}
        onClick={handleAction}
      >
        {buying ? <Loader2 className="size-3.5 animate-spin" /> : isEnrolled ? <BookOpen className="size-3.5" /> : <ShoppingCart className="size-3.5" />}
        {isEnrolled ? 'Vào học' : isFree ? 'Xem' : 'Mua'}
      </Button>
      {error ? <p className="max-w-36 text-right text-[11px] font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}

export function CourseGrid({ courses }: CourseGridProps) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      const timer = window.setTimeout(() => {
        if (active) setEnrolledCourseIds(new Set());
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }
    void getMyCoursesAction().then((result) => {
      if (active && result.success && result.data) {
        setEnrolledCourseIds(new Set(result.data.map((course) => course.id)));
      }
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  if (courses.length === 0) {
    return (
      <div className="col-span-full">
        <PublicState
          icon={BookOpen}
          title="Không tìm thấy khóa học phù hợp"
          description="Thử đổi từ khóa tìm kiếm, bỏ bớt bộ lọc hoặc chọn danh mục khác để xem thêm khóa học."
        />
      </div>
    );
  }

  return (
    <>
      {courses.map((course) => {
        const isEnrolled = enrolledCourseIds.has(course.id);
        return (
          <PublicCourseCard
            key={course.id}
            course={course}
            isEnrolled={isEnrolled}
            action={<CourseAction course={course} isEnrolled={isEnrolled} />}
          />
        );
      })}
    </>
  );
}
