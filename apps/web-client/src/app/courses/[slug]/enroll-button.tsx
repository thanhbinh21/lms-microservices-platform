'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { enrollCourseAction } from '@/app/actions/student';
import { Loader2 } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';

interface EnrollButtonProps {
  courseId: string;
  isEnrolled: boolean;
  isFree?: boolean;
}

export function EnrollButton({ courseId, isEnrolled, isFree = true }: EnrollButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string>('');

  const handleEnroll = async () => {
    if (isEnrolled) {
      router.push(`/learn/${courseId}`);
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    setErrorStr('');
    
    // Calls unified enroll api
    const result = await enrollCourseAction(courseId);
    setIsLoading(false);

    if (result.success) {
      router.push(`/learn/${courseId}`);
    } else {
      if (result.code === 401) {
        setErrorStr('Vui lòng đăng nhập để ghi danh!');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setErrorStr(result.message || 'Có lỗi xảy ra');
      }
    }
  };

  if (isEnrolled) {
    return (
      <Button onClick={() => router.push(`/learn/${courseId}`)}>
        Vào học ngay
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleEnroll} disabled={isLoading} className="font-bold px-8 shadow-md">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Đăng ký khóa học
      </Button>
      {errorStr && <p className="text-xs text-red-500 font-semibold">{errorStr}</p>}
    </div>
  );
}
