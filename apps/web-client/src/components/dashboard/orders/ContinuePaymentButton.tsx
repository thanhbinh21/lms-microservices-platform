'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';
import { continuePaymentAction } from '@/app/actions/payment';
import { Button } from '@/components/ui/button';

interface ContinuePaymentButtonProps {
  orderId: string;
}

export function ContinuePaymentButton({ orderId }: ContinuePaymentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const result = await continuePaymentAction(orderId);
    setIsLoading(false);

    if (!result.success || !result.data) {
      router.refresh();
      return;
    }

    if (result.data.action === 'LEARN') {
      router.push(`/learn/${result.data.courseId}`);
      return;
    }

    if (result.data.payUrl) {
      window.location.href = result.data.payUrl;
      return;
    }

    router.refresh();
  };

  return (
    <Button type="button" size="sm" className="gap-2" disabled={isLoading} onClick={handleContinue}>
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
      {isLoading ? 'Đang tạo giao dịch...' : 'Tiếp tục thanh toán'}
    </Button>
  );
}
