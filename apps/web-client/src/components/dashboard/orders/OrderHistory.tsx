import Link from 'next/link';
import { ArrowRight, ReceiptText, Wallet } from 'lucide-react';
import { getMyOrdersAction, type OrderDto } from '@/app/actions/payment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContinuePaymentButton } from './ContinuePaymentButton';

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

function formatCurrency(amount: number, currency: string) {
  return `${Number(amount).toLocaleString('vi-VN')} ${currency}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

function courseLabel(order: OrderDto) {
  return order.courseTitle || `Khóa học ${order.courseId.slice(0, 8)}...`;
}

export async function OrderHistory() {
  const result = await getMyOrdersAction();
  const orders = result.data ?? [];
  const completedCount = orders.filter((order) => order.status === 'COMPLETED').length;
  const paidAmount = orders
    .filter((order) => order.status === 'COMPLETED')
    .reduce((sum, order) => sum + Number(order.amount), 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lịch sử đơn hàng</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi giao dịch VNPay và truy cập nhanh vào khóa học đã mua.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit gap-2">
          <Link href="/dashboard/courses">
            Khóa học của tôi
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Tổng đơn</p>
              <p className="text-xl font-semibold">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ArrowRight className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Đã thanh toán</p>
              <p className="text-xl font-semibold">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="flex items-center gap-3 p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Đã chi</p>
              <p className="text-xl font-semibold text-primary">{paidAmount.toLocaleString('vi-VN')} đ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!result.success && (
        <Card className="rounded-xl border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-6 text-sm text-rose-700">
            Không thể tải đơn hàng: {result.message}
          </CardContent>
        </Card>
      )}

      {result.success && orders.length === 0 && (
        <Card className="rounded-xl border-white/60 bg-white/70 shadow-sm">
          <CardContent className="py-12 text-center">
            <Wallet className="mx-auto mb-3 size-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Bạn chưa có đơn hàng nào.</p>
            <Button asChild className="mt-4">
              <Link href="/courses">Khám phá khóa học</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="rounded-xl border-white/60 bg-white/70 shadow-sm backdrop-blur">
            <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-medium">Đơn #{order.vnpTxnRef}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Khóa học</p>
                  <p className="mt-1 font-medium text-foreground">{courseLabel(order)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Tổng tiền</p>
                  <p className="mt-1 font-semibold text-primary">
                    {formatCurrency(order.amount, order.currency)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {order.status === 'PENDING' && <ContinuePaymentButton orderId={order.id} />}
                {order.status === 'COMPLETED' && (
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link href={`/learn/${order.courseId}`}>
                      <ArrowRight className="size-4" />
                      Vào học
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
