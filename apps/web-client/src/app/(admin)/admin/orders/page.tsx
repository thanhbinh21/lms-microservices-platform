'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Receipt, RotateCcw, Search } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getAdminOrdersAction,
  type AdminOrderDto,
} from '@/app/actions/admin';

type OrderStatus = 'ALL' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Chờ thanh toán', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Hoàn tất',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FAILED:    { label: 'Thất bại',        cls: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRED:   { label: 'Hết hạn',         cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  REFUNDED:  { label: 'Hoàn tiền',       cls: 'bg-purple-100 text-purple-700 border-purple-200' },
};

function formatVnd(v: number) {
  return `${v.toLocaleString('vi-VN')} đ`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

const STATUS_FILTERS: { value: OrderStatus; label: string }[] = [
  { value: 'ALL',       label: 'Tất cả' },
  { value: 'PENDING',   label: 'Chờ TT' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'FAILED',    label: 'Thất bại' },
  { value: 'EXPIRED',   label: 'Hết hạn' },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getAdminOrdersAction({
      page,
      limit: 20,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      userId: search || undefined,
    });
    if (result.success && result.data) {
      setOrders(result.data.orders);
      setTotalPages(result.data.pagination.totalPages);
      setTotal(result.data.pagination.total);
    } else {
      setError(result.message || 'Không thể tải danh sách đơn hàng.');
    }
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="workspace-page space-y-6">
      <AdminPageHeader
        eyebrow={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Receipt className="size-3.5" />
            Đơn hàng · Event Sourcing
          </div>
        }
        title="Quản lý đơn thanh toán"
        description="Xem lifecycle đầy đủ của từng payment order thông qua Event Sourcing. Mỗi order có chuỗi events ghi lại từng thay đổi trạng thái."
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-white/60 bg-white/50 text-muted-foreground hover:bg-white/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Tìm theo userId…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-8 w-52 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8 gap-1">
            <Search className="size-3.5" />
            Tìm
          </Button>
          {search && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            >
              Xoá
            </Button>
          )}
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/60">
        {/* Header row */}
        <div className="hidden grid-cols-[1fr_1.5fr_1fr_auto_auto] gap-4 border-b border-white/40 bg-white/30 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Mã đơn</span>
          <span>Khóa học</span>
          <span>Số tiền</span>
          <span>Trạng thái</span>
          <span>Ngày tạo</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Đang tải đơn hàng…
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Receipt className="size-10 opacity-30" />
            <p className="text-sm">Chưa có đơn hàng nào{statusFilter !== 'ALL' ? ` với trạng thái "${STATUS_LABELS[statusFilter]?.label}"` : ''}.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/30">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold text-foreground">
                      {order.id.slice(0, 8)}…
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {order.vnpTxnRef}
                    </p>
                  </div>
                  <div className="hidden min-w-0 flex-[1.5] sm:block">
                    <p className="truncate text-sm font-medium text-foreground">
                      {order.courseTitle ?? order.courseId.slice(0, 12) + '…'}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      user: {order.userId.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">{formatVnd(order.amount)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{order.currency}</p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        {!loading && orders.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/40 bg-white/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Tổng {total.toLocaleString('vi-VN')} đơn · trang {page}/{totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Tiếp
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={fetchOrders}
              >
                <RotateCcw className="size-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-800">
        <p className="font-semibold">Về Event Sourcing</p>
        <p className="mt-1 text-blue-700">
          Mỗi đơn hàng có một chuỗi events bất biến ghi lại toàn bộ lifecycle: từ
          <code className="mx-1 rounded bg-blue-100 px-1 font-mono text-xs">ORDER_CREATED</code> →
          <code className="mx-1 rounded bg-blue-100 px-1 font-mono text-xs">PAYMENT_URL_GENERATED</code> →
          <code className="mx-1 rounded bg-blue-100 px-1 font-mono text-xs">VNPAY_CALLBACK_RECEIVED</code> →
          <code className="mx-1 rounded bg-blue-100 px-1 font-mono text-xs">PAYMENT_VERIFIED</code> →
          <code className="mx-1 rounded bg-blue-100 px-1 font-mono text-xs">ORDER_COMPLETED</code>.
          Click vào từng đơn để xem event timeline đầy đủ.
          Đây khác với <strong>Audit Log</strong> (ai làm gì) và <strong>DLQ</strong> (Kafka event lỗi).
        </p>
      </div>
    </div>
  );
}
