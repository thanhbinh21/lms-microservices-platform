'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { enrollFreeCourseAction } from '@/app/actions/student';
import { Loader2 } from 'lucide-react';

interface EnrollButtonProps {
  courseId: string;
  isEnrolled: boolean;
  isFree?: boolean;
}

export function EnrollButton({ courseId, isEnrolled, isFree = true }: EnrollButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string>('');

  const handleEnroll = async () => {
    if (isEnrolled) {
      router.push(`/learn/${courseId}`);
      return;
    }

    if (!isFree) {
      setErrorStr('Ghi danh trả phí đang được cập nhật!');
      return;
    }

    setIsLoading(true);
    setErrorStr('');
    const result = await enrollFreeCourseAction(courseId);
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
        Vào học kế tiếp
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleEnroll} disabled={isLoading} variant={isFree ? 'default' : 'secondary'}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isFree ? 'Tham gia học trải nghiệm' : 'Đăng ký (Cập nhật sau)'}
      </Button>
      {errorStr && <p className="text-xs text-red-500 font-semibold">{errorStr}</p>}
    </div>
  );
}
