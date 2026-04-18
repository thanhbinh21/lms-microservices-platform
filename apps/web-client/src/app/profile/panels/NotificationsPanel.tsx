'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bell,
  BookOpen,
  CheckCheck,
  CircleDot,
  Info,
  Loader2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  getMyNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationDto,
  type NotificationType,
} from '@/app/actions/notification';

const TYPE_META: Record<
  NotificationType,
  { label: string; icon: typeof Bell; color: string; bg: string }
> = {
  PAYMENT_SUCCESS: {
    label: 'Thanh toán',
    icon: Wallet,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
  },
  ENROLLMENT_CREATED: {
    label: 'Ghi danh',
    icon: BookOpen,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  COURSE_COMPLETED: {
    label: 'Hoàn thành',
    icon: Sparkles,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  LESSON_COMPLETED: {
    label: 'Bài học',
    icon: CircleDot,
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
  },
  SYSTEM: {
    label: 'Hệ thống',
    icon: Info,
    color: 'text-slate-600',
    bg: 'bg-slate-500/10',
  },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export function NotificationsPanel() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await getMyNotificationsAction({
      unreadOnly: filter === 'unread',
      limit: 50,
    });
    if (res.success && res.data) {
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
    } else {
      setItems([]);
      setError(res.message || 'Không thể tải thông báo. Kiểm tra notification-service đang chạy.');
    }
  }, [filter]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const handleMarkOne = async (id: string) => {
    setItems((prev) =>
      prev
        ? prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n))
        : prev,
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationReadAction(id);
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    const res = await markAllNotificationsReadAction();
    if (res.success) {
      setUnreadCount(0);
      setItems((prev) =>
        prev ? prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })) : prev,
      );
    }
    setMarkingAll(false);
  };

  return (
    <Card className="glass-panel rounded-[2rem] border-white/60 shadow-xl">
      <CardHeader className="p-8 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="size-5" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Thông báo</CardTitle>
              <CardDescription className="text-sm font-medium">
                Cập nhật về thanh toán, ghi danh và hoạt động tài khoản.
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {unreadCount} chưa đọc
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={markingAll || unreadCount === 0}
            className="gap-2 rounded-xl font-bold"
          >
            {markingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCheck className="size-4" />
            )}
            Đánh dấu tất cả đã đọc
          </Button>
        </div>

        <div className="flex gap-2 pt-4">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                filter === f
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-white/60 text-muted-foreground hover:bg-white/90'
              }`}
            >
              {f === 'all' ? 'Tất cả' : 'Chưa đọc'}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-8 pt-2">
        {items === null ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-60">
            <Loader2 className="size-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Đang tải thông báo...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="mx-auto size-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {filter === 'unread' ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.SYSTEM;
              const Icon = meta.icon;
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => unread && handleMarkOne(n.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      unread
                        ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                        : 'border-white/60 bg-white/40 hover:bg-white/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-10 shrink-0 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center shadow-inner`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold leading-tight">
                            {n.title}
                            {unread && (
                              <span className="ml-2 inline-block size-2 rounded-full bg-primary align-middle" />
                            )}
                          </p>
                          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                          {n.body}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                          {n.channel && (
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                              {n.channel === 'EMAIL' ? 'Email' : 'Trong ứng dụng'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
