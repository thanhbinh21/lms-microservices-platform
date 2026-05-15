'use client';

import { useState, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  getMyNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationDto,
} from '@/app/actions/notification';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/redux/hooks';
import { toast } from '@/components/ui/toast';

function fallbackRouteByRole(role?: string) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'INSTRUCTOR') return '/instructor';
  return '/dashboard';
}

function resolveNotificationTarget(notification: NotificationDto, role?: string) {
  const metadata = notification.metadata as Record<string, unknown> | null;
  const metadataRoute = typeof metadata?.route === 'string' ? metadata.route.trim() : '';
  if (
    metadataRoute
    && metadataRoute.startsWith('/')
    && (
      metadataRoute.startsWith('/dashboard')
      || metadataRoute.startsWith('/learn/')
      || metadataRoute.startsWith('/instructor')
      || metadataRoute.startsWith('/studio')
      || metadataRoute.startsWith('/admin')
      || metadataRoute.startsWith('/qa/')
      || metadataRoute.startsWith('/support')
      || metadataRoute.startsWith('/courses/')
    )
  ) {
    return metadataRoute;
  }

  const courseId = typeof metadata?.courseId === 'string' ? metadata.courseId : '';
  const orderId = typeof metadata?.orderId === 'string' ? metadata.orderId : '';

  if (notification.type === 'PAYMENT_SUCCESS' || orderId) return '/dashboard/orders';

  if (notification.type === 'ENROLLMENT_CREATED' && courseId) {
    return `/learn/${courseId}`;
  }

  if (notification.type === 'ENROLLMENT_CREATED') {
    return '/dashboard/courses';
  }

  if ((notification.type === 'COURSE_COMPLETED' || notification.type === 'LESSON_COMPLETED') && courseId) {
    return `/learn/${courseId}`;
  }

  return fallbackRouteByRole(role);
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const { user } = useAppSelector((state) => state.auth);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      setError('');
      const res = await getMyNotificationsAction({ limit: 10 });
      if (res.success && res.data) {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unreadCount || 0);
        return;
      }

      setNotifications([]);
      setUnreadCount(0);
      setError(res.message || 'Không tải được thông báo.');
    } catch (e) {
      console.error('Failed to load notifications', e);
      setNotifications([]);
      setUnreadCount(0);
      setError('Không kết nối được notification-service. Vui lòng thử lại.');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setInitialLoading(true);
      void fetchNotifications();
    }
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setBusy(true);
      const result = await markNotificationReadAction(id);
      if (result.success) {
        toast('success', 'Đã đánh dấu đã đọc');
      } else {
        toast('error', 'Đánh dấu thất bại', result.message || 'Vui lòng thử lại.');
      }
      await fetchNotifications();
    } finally {
      setBusy(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setBusy(true);
      const result = await markAllNotificationsReadAction();
      if (result.success) {
        toast('success', 'Đã đánh dấu tất cả là đã đọc');
      } else {
        toast('error', 'Không thể đánh dấu tất cả', result.message || 'Vui lòng thử lại.');
      }
      await fetchNotifications();
    } finally {
      setBusy(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationDto) => {
    if (!notification.readAt) {
      const result = await markNotificationReadAction(notification.id);
      if (result.success) {
        await fetchNotifications();
      }
    }

    setOpen(false);
    router.push(resolveNotificationTarget(notification, user?.role));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
          className="relative text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(92vw,24rem)] rounded-2xl border-slate-200 p-0 shadow-xl" align="end" sideOffset={8}>
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <h4 className="text-sm font-bold text-slate-800">Thông báo</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs font-semibold text-slate-500 hover:text-primary"
              onClick={markAllAsRead}
              disabled={busy}
            >
              Đã đọc tất cả
            </Button>
          )}
        </div>

        <div className="max-h-80 w-full overflow-y-auto sm:max-h-96">
          {initialLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted"></div>
                    <div className="h-4 w-4 animate-pulse rounded-full bg-muted"></div>
                  </div>
                  <div className="h-3 w-full animate-pulse rounded bg-muted/60"></div>
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted/60"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="workspace-state min-h-28 flex-col gap-3">
                <p>{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInitialLoading(true);
                    void fetchNotifications();
                  }}
                >
                  Thử lại
                </Button>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Không có thông báo nào.
            </div>
          ) : (
            <div className="flex flex-col py-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${!notification.readAt ? 'bg-primary/5' : ''}`}
                  onClick={() => void handleNotificationClick(notification)}
                >
                  <div className="mt-1 flex-shrink-0">
                    {!notification.readAt ? (
                      <div className="size-2 rounded-full bg-primary" />
                    ) : (
                      <div className="size-2 rounded-full bg-slate-200" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!notification.readAt ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                        {notification.title}
                      </p>
                    </div>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {notification.body}
                    </p>

                    <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })}
                    </p>
                  </div>

                  {!notification.readAt && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                      onClick={(e) => void markAsRead(notification.id, e)}
                      title="Đánh dấu đã đọc"
                      disabled={busy}
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50 p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs font-semibold text-slate-500" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
