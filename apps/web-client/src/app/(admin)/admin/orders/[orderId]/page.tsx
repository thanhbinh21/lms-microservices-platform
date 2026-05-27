'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Receipt,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wifi,
  ShieldCheck,
  Link2,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { getAdminOrderEventHistoryAction, type OrderEventItemDto, type OrderEventHistoryDto } from '@/app/actions/admin';

// Cau hinh hien thi cho tung event type
const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  ORDER_CREATED: {
    label: 'Đơn hàng được tạo',
    icon: Receipt,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
  },
  PAYMENT_URL_GENERATED: {
    label: 'URL thanh toán VNPay đã tạo',
    icon: Link2,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-300',
  },
  VNPAY_CALLBACK_RECEIVED: {
    label: 'Nhận callback từ VNPay',
    icon: Wifi,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
  },
  PAYMENT_VERIFIED: {
    label: 'Xác minh thanh toán thành công',
    icon: ShieldCheck,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    borderColor: 'border-teal-300',
  },
  ORDER_COMPLETED: {
    label: 'Đơn hoàn tất — học viên được enroll',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
  },
  ORDER_FAILED: {
    label: 'Thanh toán thất bại',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  ORDER_EXPIRED: {
    label: 'Đơn hàng hết hạn',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
  },
  ORDER_REFUNDED: {
    label: 'Đã hoàn tiền',
    icon: RefreshCw,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
  },
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FAILED:    'bg-red-100 text-red-700 border-red-200',
  EXPIRED:   'bg-slate-100 text-slate-600 border-slate-200',
  REFUNDED:  'bg-purple-100 text-purple-700 border-purple-200',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Chờ thanh toán',
  COMPLETED: 'Hoàn tất',
  FAILED:    'Thất bại',
  EXPIRED:   'Hết hạn',
  REFUNDED:  'Hoàn tiền',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatVnd(v: number) {
  return `${v.toLocaleString('vi-VN')} đ`;
}

function JsonBlock({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(data, null, 2);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        {open ? 'Ẩn' : 'Xem'} payload
      </button>
      {open && (
        <pre className="mt-1.5 overflow-x-auto rounded-lg bg-black/5 p-3 text-[11px] leading-relaxed text-foreground/80">
          {json}
        </pre>
      )}
    </div>
  );
}

function EventCard({ event, isLast }: { event: OrderEventItemDto; isLast: boolean }) {
  const cfg = EVENT_CONFIG[event.type] ?? {
    label: event.type,
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border',
  };
  const Icon = cfg.icon;

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-border" />
      )}

      {/* Icon dot */}
      <div className={`relative z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${cfg.bgColor} ${cfg.borderColor}`}>
        <Icon className={`size-5 ${cfg.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{event.type}</p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <span className="rounded-full bg-white/60 border border-white/80 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              v{event.version}
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.occurredAt)}</p>
        <div className="mt-2 rounded-xl border border-white/60 bg-white/40 p-3">
          <JsonBlock data={event.payload} />
          {event.metadata && (
            <div className="mt-1">
              <JsonBlock data={event.metadata} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentStateCard({ state, totalEvents }: { state: OrderEventHistoryDto['currentState']; totalEvents: number }) {
  const statusCls = STATUS_STYLES[state.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const statusLabel = STATUS_LABELS[state.status] ?? state.status;

  return (
    <div className="glass-panel rounded-2xl border border-white/60 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Trạng thái hiện tại</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${statusCls}`}>
              {statusLabel}
            </span>
            <span className="text-sm font-semibold text-foreground">{formatVnd(state.amount)}</span>
            <span className="text-xs text-muted-foreground">{state.currency}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Version</p>
          <p className="text-lg font-black text-foreground">v{state.version}</p>
          <p className="text-xs text-muted-foreground">{totalEvents} events</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div>
          <p className="font-semibold text-muted-foreground">User ID</p>
          <p className="mt-0.5 truncate font-mono text-foreground">{state.userId}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Course ID</p>
          <p className="mt-0.5 truncate font-mono text-foreground">{state.courseId}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">VNPay TxnRef</p>
          <p className="mt-0.5 truncate font-mono text-foreground">{state.vnpTxnRef}</p>
        </div>
        {state.vnpTransactionNo && (
          <div>
            <p className="font-semibold text-muted-foreground">VNPay TransNo</p>
            <p className="mt-0.5 truncate font-mono text-foreground">{state.vnpTransactionNo}</p>
          </div>
        )}
        {state.vnpResponseCode && (
          <div>
            <p className="font-semibold text-muted-foreground">Response Code</p>
            <p className="mt-0.5 font-mono text-foreground">{state.vnpResponseCode}</p>
          </div>
        )}
        {state.paidAt && (
          <div>
            <p className="font-semibold text-muted-foreground">Thanh toán lúc</p>
            <p className="mt-0.5 text-foreground">{formatDate(state.paidAt)}</p>
          </div>
        )}
        {state.expiresAt && (
          <div>
            <p className="font-semibold text-muted-foreground">Hết hạn lúc</p>
            <p className="mt-0.5 text-foreground">{formatDate(state.expiresAt)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default function AdminOrderEventPage({ params }: PageProps) {
  const { orderId } = use(params);
  const [data, setData] = useState<OrderEventHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getAdminOrderEventHistoryAction(orderId).then((result) => {
      if (result.success && result.data) {
        setData(result.data);
        setError('');
      } else {
        setError(result.message || 'Không thể tải event history.');
      }
      setLoading(false);
    });
  }, [orderId]);

  return (
    <div className="workspace-page space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders">
          <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
            <ArrowLeft className="size-4" />
            Đơn hàng
          </Button>
        </Link>
      </div>

      <AdminPageHeader
        eyebrow={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Receipt className="size-3.5" />
            Event Timeline · Payment Order
          </div>
        }
        title={`Lịch sử sự kiện đơn hàng`}
        description={orderId}
      />


      {/* Phân biệt 3 loại log */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: '📋 Event Sourcing (đây)',
            desc: 'Lifecycle trạng thái của từng payment order: ORDER_CREATED → COMPLETED/FAILED/EXPIRED',
            active: true,
          },
          {
            title: '🔍 Audit Log',
            desc: 'Ghi nhận hành động của admin/service (ai làm gì với resource nào)',
            active: false,
            href: '/admin/audit-log',
          },
          {
            title: '☠️ DLQ',
            desc: 'Kafka event xử lý lỗi — retry hoặc resolve failed event',
            active: false,
            href: '/admin/dlq',
          },
        ].map((item) => (
          <div
            key={item.title}
            className={`rounded-xl border p-3 text-xs ${
              item.active
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-white/60 bg-white/40 text-muted-foreground'
            }`}
          >
            <p className="font-bold">{item.title}</p>
            <p className="mt-1 leading-relaxed">{item.desc}</p>
            {item.href && (
              <Link href={item.href} className="mt-1.5 inline-block underline hover:text-foreground">
                Xem →
              </Link>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Đang tải event history…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Current State projection */}
          <CurrentStateCard state={data.currentState} totalEvents={data.totalEvents} />

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Event Stream · {data.totalEvents} sự kiện
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Timeline */}
          <div className="glass-panel rounded-2xl border border-white/60 p-5">
            {data.events.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                isLast={idx === data.events.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
