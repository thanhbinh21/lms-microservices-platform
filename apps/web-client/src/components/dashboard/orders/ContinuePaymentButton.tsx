'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';
import { continuePaymentAction } from '@/app/actions/payment';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

interface ContinuePaymentButtonProps {
  orderId: string;
  label?: string;
}

export function ContinuePaymentButton({ orderId, label = 'Tiếp tục thanh toán' }: ContinuePaymentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const result = await continuePaymentAction(orderId);
    setIsLoading(false);

    if (!result.success || !result.data) {
      toast('error', 'Không thể tạo giao dịch mới', result.message || 'Vui lòng thử lại sau.');
      router.refresh();
      return;
    }

    if (result.data.action === 'LEARN') {
      toast('success', 'Khóa học đã sẵn sàng', 'Bạn đã thanh toán khóa học này.');
      router.push(`/learn/${result.data.courseId}`);
      return;
    }

    if (result.data.payUrl) {
      toast('info', 'Đang chuyển sang VNPay', 'Hệ thống đã tạo giao dịch mới, không dùng lại URL cũ.');
      window.location.href = result.data.payUrl;
      return;
    }

    toast('error', 'Không nhận được URL thanh toán', 'Vui lòng thử lại hoặc gửi yêu cầu hỗ trợ.');
    router.refresh();
  };

  return (
    <Button type="button" size="sm" className="gap-2 rounded-xl font-semibold" disabled={isLoading} onClick={handleContinue}>
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
      {isLoading ? 'Đang tạo giao dịch...' : label}
    </Button>
  );
}
