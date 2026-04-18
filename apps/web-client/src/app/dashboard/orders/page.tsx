import Link from 'next/link';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMyOrdersAction, type OrderDto } from '@/app/actions/payment';

const STATUS_LABEL: Record<OrderDto['status'], string> = {
  PENDING: 'Đang chờ thanh toán',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
};

const STATUS_COLOR: Record<OrderDto['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
  REFUNDED: 'bg-blue-100 text-blue-700',
};

export default async function OrdersPage() {
  const result = await getMyOrdersAction();
  const orders = result.data ?? [];

  return (
    <div className="glass-page min-h-screen text-foreground relative overflow-hidden pb-20">
      <div className="absolute top-[-10%] right-[-5%] w-[35%] h-[40%] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-4xl px-4 py-10 md:px-6 space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lịch sử đơn hàng</h1>
            <p className="text-sm text-muted-foreground">
              Theo dõi các giao dịch thanh toán khóa học qua VNPay.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">← Dashboard</Link>
          </Button>
        </div>

        {!result.success && (
          <Card className="rounded-2xl border-rose-200 bg-rose-50">
            <CardContent className="py-6 text-sm text-rose-700">
              Không thể tải đơn hàng: {result.message}
            </CardContent>
          </Card>
        )}

        {result.success && orders.length === 0 && (
          <Card className="rounded-2xl border-white/60 bg-white/70">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Bạn chưa có đơn hàng nào.{' '}
              <Link href="/courses" className="text-primary font-semibold underline">
                Khám phá khóa học
              </Link>
              .
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base font-bold truncate">
                    Đơn #{order.vnpTxnRef}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap ${STATUS_COLOR[order.status]}`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="space-y-0.5">
                  <p>
                    <span className="text-muted-foreground">Khóa học:</span>{' '}
                    <Link
                      href={`/courses/${order.courseId}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {order.courseId.slice(0, 8)}...
                    </Link>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tổng tiền:</span>{' '}
                    <span className="font-bold text-primary">
                      {Number(order.amount).toLocaleString('vi-VN')} {order.currency}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {order.status === 'PENDING' && order.vnpPayUrl && (
                    <Button asChild size="sm">
                      <a href={order.vnpPayUrl} target="_self" rel="noopener">
                        Tiếp tục thanh toán
                      </a>
                    </Button>
                  )}
                  {order.status === 'COMPLETED' && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/learn/${order.courseId}`}>Vào học</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <SharedFooter />
    </div>
  );
}
