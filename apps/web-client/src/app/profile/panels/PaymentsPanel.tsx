'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, ExternalLink, ArrowRight } from 'lucide-react';
import { getMyOrdersAction, type OrderDto } from '@/app/actions/payment';

const STATUS_LABEL: Record<OrderDto['status'], string> = {
  PENDING: 'Đang chờ',
  COMPLETED: 'Thành công',
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

export function PaymentsPanel() {
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getMyOrdersAction();
      if (res.success && res.data) {
        setOrders(res.data);
      } else {
        setOrders([]);
        setError(res.message || 'Không thể tải lịch sử thanh toán.');
      }
    })();
  }, []);

  const stats = {
    total: orders?.length ?? 0,
    completed: orders?.filter((o) => o.status === 'COMPLETED').length ?? 0,
    spent:
      orders?.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + Number(o.amount), 0) ??
      0,
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel rounded-[2rem] border-white/60 shadow-xl">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="size-5" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Lịch sử thanh toán</CardTitle>
              <CardDescription className="text-sm font-medium">
                Theo dõi giao dịch VNPay cho các khóa học đã mua.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-8 pt-0 pb-2">
          <div className="grid grid-cols-3 gap-3 pb-6">
            <div className="rounded-xl border border-white/60 bg-white/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tổng đơn
              </p>
              <p className="mt-1 text-xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Thành công
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{stats.completed}</p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Đã chi
              </p>
              <p className="mt-1 text-xl font-bold text-primary">
                {stats.spent.toLocaleString('vi-VN')}đ
              </p>
            </div>
          </div>
        </CardContent>

        <CardContent className="px-8 pb-8 pt-0">
          {orders === null ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-60">
              <Loader2 className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Đang tải đơn hàng...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-4">
                Bạn chưa có đơn hàng nào.
              </p>
              <Link href="/courses">
                <Button className="rounded-full px-6 font-bold shadow-md">
                  Khám phá khóa học
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-white/60 bg-white/50 p-4 hover:bg-white/80 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">Đơn #{order.vnpTxnRef}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Khóa học: <code className="font-mono">{order.courseId.slice(0, 8)}...</code>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[order.status]}`}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                      <p className="text-base font-bold text-primary whitespace-nowrap">
                        {Number(order.amount).toLocaleString('vi-VN')} {order.currency}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {order.status === 'PENDING' && order.vnpPayUrl && (
                      <Button asChild size="sm" className="rounded-lg font-bold">
                        <a href={order.vnpPayUrl} target="_self" rel="noopener">
                          <ExternalLink className="mr-1.5 size-3.5" />
                          Tiếp tục thanh toán
                        </a>
                      </Button>
                    )}
                    {order.status === 'COMPLETED' && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold border-emerald-300"
                      >
                        <Link href={`/learn/${order.courseId}`}>
                          <ArrowRight className="mr-1.5 size-3.5" />
                          Vào học
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {orders && orders.length > 5 && (
        <div className="flex justify-center">
          <Link href="/dashboard/orders">
            <Button variant="outline" className="gap-2 rounded-xl font-bold">
              Xem trang đầy đủ
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
