'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  getMyNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationDto
} from '@/app/actions/notification';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await getMyNotificationsAction({ limit: 10 });
      if (res.success && res.data) {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setInitialLoading(false);
    }
  };

  // Fetch initial notifications
  useEffect(() => {
    fetchNotifications();
    // Optional: Set up an interval or web socket here for real-time
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchNotifications();
    }
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await markNotificationReadAction(id);
      await fetchNotifications();
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await markAllNotificationsReadAction();
      await fetchNotifications();
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationDto) => {
    if (!notification.readAt) {
      await markNotificationReadAction(notification.id);
      await fetchNotifications();
    }
    setOpen(false);
    
    // Simple routing logic based on notification type / metadata
    if (notification.type === 'PAYMENT_SUCCESS') {
      router.push('/dashboard?tab=orders');
    } else if (notification.type === 'ENROLLMENT_CREATED' && notification.metadata?.courseId) {
      router.push(`/learn/${notification.metadata.courseId}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl shadow-xl border-slate-200" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 rounded-t-2xl">
          <h4 className="font-bold text-sm text-slate-800">Thông báo</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto px-2 py-1 text-xs font-semibold text-slate-500 hover:text-primary"
              onClick={markAllAsRead}
              disabled={loading}
            >
              Đánh dấu đã đọc tất cả
            </Button>
          )}
        </div>
        <div className="max-h-80 w-full sm:max-h-96 overflow-y-auto">
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
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="mt-1 flex-shrink-0">
                    {!notification.readAt ? (
                      <div className="size-2 rounded-full bg-primary" />
                    ) : (
                      <div className="size-2 rounded-full bg-slate-200" />
                    )}
                  </div>
                  <div className="flex flex-col flex-1 gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!notification.readAt ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                        {notification.title}
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500 line-clamp-2 mt-0.5">
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
                      className="size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary" 
                      onClick={(e) => markAsRead(notification.id, e)}
                      title="Đánh dấu đã đọc"
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-2 bg-slate-50 rounded-b-2xl">
          <Button variant="ghost" size="sm" className="w-full text-xs font-semibold text-slate-500" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
