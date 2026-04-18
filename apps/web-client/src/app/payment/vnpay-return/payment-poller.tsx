'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOrderAction } from '@/app/actions/payment';

interface PaymentPollerProps {
  orderId: string;
  maxAttempts?: number;
  intervalMs?: number;
}

/**
 * Poll order status vai lan sau khi return — dung cho truong hop:
 *  - IPN se ve nhanh trong vong vai giay (consumer Kafka tao enrollment).
 *  - Dev khong co IPN thuc, Return URL handler da update tuc thi.
 */
export function PaymentPoller({
  orderId,
  maxAttempts = 10,
  intervalMs = 2000,
}: PaymentPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>('PENDING');
  const [attempts, setAttempts] = useState(0);
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      while (!cancelled && attempt < maxAttempts) {
        const result = await getOrderAction(orderId);
        if (!cancelled && result.success && result.data) {
          setStatus(result.data.status);
          setCourseId(result.data.courseId);
          if (result.data.status === 'COMPLETED') {
            setTimeout(() => {
              if (!cancelled) router.push(`/learn/${result.data!.courseId}`);
            }, 1200);
            return;
          }
          if (['FAILED', 'EXPIRED', 'REFUNDED'].includes(result.data.status)) {
            return;
          }
        }
        attempt += 1;
        setAttempts(attempt);
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [orderId, maxAttempts, intervalMs, router]);

  return (
    <div className="flex flex-col items-center gap-3 pt-4">
      {status === 'PENDING' && (
        <>
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">
            Đang kiểm tra... ({attempts}/{maxAttempts})
          </p>
        </>
      )}
      {status === 'COMPLETED' && courseId && (
        <>
          <p className="text-sm font-semibold text-emerald-600">
            Đã ghi danh! Đang chuyển hướng vào lớp học...
          </p>
          <Button onClick={() => router.push(`/learn/${courseId}`)}>Vào học ngay</Button>
        </>
      )}
      {attempts >= maxAttempts && status === 'PENDING' && (
        <p className="text-xs text-muted-foreground text-center">
          Webhook IPN chưa về. Trong môi trường local, VNPay sandbox không thể gọi localhost. Vui
          lòng kiểm tra{' '}
          <a href="/dashboard/orders" className="text-primary underline">
            trang đơn hàng
          </a>{' '}
          sau vài phút.
        </p>
      )}
    </div>
  );
}
