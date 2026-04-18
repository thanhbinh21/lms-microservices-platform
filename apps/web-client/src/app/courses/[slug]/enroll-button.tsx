'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { enrollCourseAction } from '@/app/actions/student';
import { createOrderAction } from '@/app/actions/payment';
import { Loader2, ShoppingCart } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';

interface EnrollButtonProps {
  courseId: string;
  isEnrolled: boolean;
  isFree?: boolean;
  price?: number;
}

export function EnrollButton({ courseId, isEnrolled, isFree = true, price = 0 }: EnrollButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string>('');

  const handleClick = async () => {
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

    if (isFree) {
      // Khoa hoc free: goi thang course-service enroll.
      const result = await enrollCourseAction(courseId);
      setIsLoading(false);

      if (result.success) {
        router.push(`/learn/${courseId}`);
      } else if (result.code === 401) {
        setErrorStr('Vui lòng đăng nhập để ghi danh!');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setErrorStr(result.message || 'Có lỗi xảy ra');
      }
      return;
    }

    // Khoa hoc tra phi: tao order -> redirect sang VNPay.
    const orderRes = await createOrderAction(courseId);
    setIsLoading(false);

    if (!orderRes.success || !orderRes.data?.payUrl) {
      if (orderRes.code === 401) {
        setErrorStr('Vui lòng đăng nhập để mua khóa học');
        setTimeout(() => router.push('/login'), 1500);
      } else if (orderRes.code === 409) {
        setErrorStr('Bạn đã mua khóa học này trước đó. Đang chuyển hướng...');
        setTimeout(() => router.push(`/learn/${courseId}`), 1500);
      } else {
        setErrorStr(orderRes.message || 'Không thể tạo đơn hàng');
      }
      return;
    }

    // Redirect to VNPay sandbox
    window.location.href = orderRes.data.payUrl;
  };

  if (isEnrolled) {
    return (
      <Button onClick={() => router.push(`/learn/${courseId}`)}>Vào học ngay</Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleClick} disabled={isLoading} className="font-bold px-8 shadow-md">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && !isFree && <ShoppingCart className="mr-2 h-4 w-4" />}
        {isFree
          ? 'Đăng ký miễn phí'
          : `Mua khóa học — ${Number(price).toLocaleString('vi-VN')}đ`}
      </Button>
      {errorStr && <p className="text-xs text-red-500 font-semibold">{errorStr}</p>}
    </div>
  );
}
