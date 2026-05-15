'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getAdminNotificationHistoryAction,
  type AdminNotificationHistoryDto,
} from '@/app/actions/admin';

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const res = await getAdminNotificationHistoryAction({ page: 1, limit: 30 });
      if (res.success && res.data) {
        setItems(res.data.items);
        setError('');
      } else {
        setError(res.message || 'Không tải được lịch sử thông báo.');
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="workspace-page">
      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader>
          <CardTitle>Lịch sử thông báo</CardTitle>
          <CardDescription>Theo dõi toàn bộ thông báo hệ thống đã phát sinh.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
          {!loading && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có bản ghi thông báo.</p>
          )}
          {!loading && !error && items.map((item) => (
            <div key={item.id} className="rounded-xl border p-3">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.type} · {item.status} · {new Date(item.createdAt).toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

