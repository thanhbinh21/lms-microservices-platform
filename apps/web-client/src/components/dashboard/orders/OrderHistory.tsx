import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, ReceiptText, Wallet, XCircle } from 'lucide-react';
import { getMyOrdersAction, type OrderDto } from '@/app/actions/payment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContinuePaymentButton } from './ContinuePaymentButton';

const STATUS_LABEL: Record<OrderDto['status'], string> = {
  PENDING: 'Chờ thanh toán',
  COMPLETED: 'Đã thanh toán',
  FAILED: 'Thanh toán lỗi',
  EXPIRED: 'Hết hạn',
  REFUNDED: 'Đã hoàn tiền',
};

const STATUS_COLOR: Record<OrderDto['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-slate-100 text-slate-700',
  REFUNDED: 'bg-blue-100 text-blue-700',
};

function formatCurrency(amount: number, currency: string) {
  return `${Number(amount).toLocaleString('vi-VN')} ${currency === 'VND' ? 'đ' : currency}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

function courseLabel(order: OrderDto) {
  return order.courseTitle || `Khóa học ${order.courseId.slice(0, 8)}...`;
}

function canRetryPayment(status: OrderDto['status']) {
  return status === 'PENDING' || status === 'EXPIRED' || status === 'FAILED';
}

export async function OrderHistory() {
  const result = await getMyOrdersAction();
  const orders = result.data ?? [];
  const completedCount = orders.filter((order) => order.status === 'COMPLETED').length;
  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const retryableCount = orders.filter((order) => order.status === 'EXPIRED' || order.status === 'FAILED').length;
  const paidAmount = orders
    .filter((order) => order.status === 'COMPLETED')
    .reduce((sum, order) => sum + Number(order.amount), 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <ReceiptText className="size-3.5" />
            Thanh toán
          </div>
          <h1 className="workspace-page-title">Lịch sử đơn hàng</h1>
          <p className="workspace-page-description">
            Theo dõi trạng thái VNPay. Khi tiếp tục thanh toán, hệ thống luôn tạo giao dịch hợp lệ mới thay vì mở lại URL cũ.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full gap-2 rounded-xl font-semibold md:w-auto">
          <Link href="/dashboard/courses">
            Khóa học của tôi
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng đơn', value: orders.length, hint: 'Tất cả giao dịch', icon: ReceiptText },
          { label: 'Đã thanh toán', value: completedCount, hint: 'Có thể vào học', icon: CheckCircle2 },
          { label: 'Chờ thanh toán', value: pendingCount, hint: 'Có thể tiếp tục', icon: Clock3 },
          { label: 'Cần thanh toán lại', value: retryableCount, hint: 'Hết hạn hoặc lỗi', icon: XCircle },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <stat.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-2xl font-bold">{stat.value.toLocaleString('vi-VN')}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">Tổng đã chi</CardTitle>
          <CardDescription className="text-xs">Chỉ tính các đơn đã hoàn tất.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-primary">{paidAmount.toLocaleString('vi-VN')} đ</p>
        </CardContent>
      </Card>

      {!result.success && (
        <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="p-6 text-sm text-rose-700">
            Không thể tải đơn hàng: {result.message}
          </CardContent>
        </Card>
      )}

      {result.success && orders.length === 0 && (
        <Card className="rounded-2xl border-dashed border-2 bg-white/50 shadow-sm">
          <CardContent className="py-14 text-center">
            <Wallet className="mx-auto mb-3 size-12 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Bạn chưa có đơn hàng nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Khi mua khóa học, trạng thái thanh toán sẽ xuất hiện tại đây.</p>
            <Button asChild className="mt-4 rounded-xl font-bold">
              <Link href="/courses">Khám phá khóa học</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="rounded-2xl border-white/60 bg-white/60 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-bold">Đơn #{order.vnpTxnRef}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Khóa học</p>
                  <p className="mt-1 font-semibold text-foreground">{courseLabel(order)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Tổng tiền</p>
                  <p className="mt-1 font-bold text-primary">{formatCurrency(order.amount, order.currency)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {canRetryPayment(order.status) && (
                  <ContinuePaymentButton orderId={order.id} label={order.status === 'PENDING' ? 'Tiếp tục thanh toán' : 'Thanh toán lại'} />
                )}
                {order.status === 'COMPLETED' && (
                  <Button asChild size="sm" variant="outline" className="gap-2 rounded-xl font-semibold">
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
