import Link from 'next/link';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { PaymentPoller } from './payment-poller';

/**
 * Trang user duoc VNPay redirect ve.
 * Flow:
 *  1) Lay query params tu VNPay (vnp_TxnRef, vnp_ResponseCode, ...).
 *  2) Gui sang backend /payment/api/vnpay-return de verify checksum va update order
 *     (dev fallback: NODE_ENV=development tu publish Kafka event neu thanh cong).
 *  3) Render trang ket qua + poll order status vai lan (enrollment tao async qua Kafka).
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';

interface ReturnData {
  success: boolean;
  orderId: string | null;
  status: string | null;
  responseCode: string;
  transactionStatus: string;
}

async function verifyReturn(query: URLSearchParams): Promise<ReturnData | null> {
  try {
    const url = `${GATEWAY_URL}/payment/api/vnpay-return?${query.toString()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    const json = (await res.json()) as { success: boolean; data: ReturnData | null };
    return json.data;
  } catch {
    return null;
  }
}

export default async function VNPayReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (typeof v === 'string') query.set(k, v);
  });

  const data = await verifyReturn(query);

  const isSuccess = data?.success && data.status === 'COMPLETED';
  const isPending = data?.success && data.status === 'PENDING';
  const isFail = !data?.success;

  return (
    <div className="glass-page min-h-screen text-foreground relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[35%] h-[40%] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[25%] left-[-10%] w-[30%] h-[35%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-2xl px-4 py-16 md:px-6 relative z-10">
        <Card className="rounded-3xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
          <CardHeader className="text-center space-y-4 pt-8">
            {isSuccess && (
              <div className="mx-auto size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="size-10 text-emerald-600" />
              </div>
            )}
            {isPending && (
              <div className="mx-auto size-16 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="size-10 text-amber-600" />
              </div>
            )}
            {isFail && (
              <div className="mx-auto size-16 rounded-full bg-rose-100 flex items-center justify-center">
                <XCircle className="size-10 text-rose-600" />
              </div>
            )}
            <CardTitle className="text-2xl font-bold">
              {isSuccess && 'Thanh toán thành công'}
              {isPending && 'Đang xác nhận giao dịch'}
              {isFail && 'Thanh toán thất bại'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-8">
            {isSuccess && (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Cảm ơn bạn! Chúng tôi đã ghi nhận giao dịch. Hệ thống đang ghi danh tự động qua
                  Kafka — bạn có thể vào học ngay.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button asChild>
                    <Link href={`/learn/${params.courseId || ''}`}>Vào học</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/orders">Xem đơn hàng</Link>
                  </Button>
                </div>
              </>
            )}

            {isPending && data?.orderId && (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Giao dịch đã được VNPay xác nhận. Chúng tôi đang đợi webhook IPN để kích hoạt ghi
                  danh. Vui lòng chờ trong giây lát...
                </p>
                <PaymentPoller orderId={data.orderId} />
              </>
            )}

            {isFail && (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Giao dịch không thành công. Mã phản hồi:{' '}
                  <code className="font-mono">{data?.responseCode || '—'}</code>. Bạn có thể thử
                  lại hoặc liên hệ hỗ trợ.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button asChild variant="outline">
                    <Link href="/courses">Quay về danh sách khóa học</Link>
                  </Button>
                </div>
              </>
            )}

            <details className="pt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Chi tiết kỹ thuật</summary>
              <pre className="mt-2 rounded-lg bg-muted/40 p-3 overflow-x-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </main>

      <SharedFooter />
    </div>
  );
}
