'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAdminNotificationHistoryAction,
  type AdminNotificationHistoryDto,
} from '@/app/actions/admin';

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getAdminNotificationHistoryAction({ page: 1, limit: 30 });
      if (res.success && res.data) setItems(res.data.items);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 md:p-8">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Dang tai...</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Chua co ban ghi thong bao.</p>
          )}
          {items.map((item) => (
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
