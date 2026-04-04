'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { enrollFreeCourseAction } from '@/app/actions/student';
import { PlayCircle, Lock, Loader2 } from 'lucide-react';

export function PreviewButton({ courseId, courseSlug, lessonId, isFree, isEnrolled }: { courseId: string, courseSlug: string, lessonId: string, isFree: boolean, isEnrolled: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!isFree) {
      alert('Bài học này yêu cầu trả phí để xem!');
      return;
    }

    if (isEnrolled) {
      router.push(`/learn/${courseSlug}?lessonId=${lessonId}`);
      return;
    }

    setIsLoading(true);
    const result = await enrollFreeCourseAction(courseId);
    if (result.success) {
      router.push(`/learn/${courseSlug}?lessonId=${lessonId}`);
    } else {
      setIsLoading(false);
      if (result.code === 401) {
        alert('Vui lòng đăng nhập để xem thử!');
        router.push('/login');
      } else {
        alert(result.message || 'Lỗi');
      }
    }
  };

  return (
    <button 
      onClick={handleClick} 
      disabled={isLoading}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all hover:scale-105 ${isFree ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 text-amber-700'}`}
    >
      {isLoading ? <Loader2 className="size-3 animate-spin"/> : (isFree ? <PlayCircle className="size-3" /> : <Lock className="size-3" />)}
      {isLoading ? 'Đang tải...' : (isFree ? 'Xem thử' : 'Trả phí')}
    </button>
  );
}
