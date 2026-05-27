'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
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
      setLoading(true);
      const result = await getAdminNotificationHistoryAction({ page: 1, limit: 30 });
      if (result.success && result.data) {
        setItems(result.data.items);
        setError('');
      } else {
        setError(result.message || 'Không tải được lịch sử thông báo.');
      }
      setLoading(false);
    })();
  }, []);

  const summary = useMemo(() => {
    const sent = items.filter((item) => ['SENT', 'DELIVERED', 'SUCCESS'].includes(item.status)).length;
    const failed = items.filter((item) => ['FAILED', 'ERROR'].includes(item.status)).length;
    const email = items.filter((item) => item.channel === 'EMAIL').length;
    return { sent, failed, email };
  }, [items]);

  return (
    <div className="workspace-page space-y-6">
      <AdminPageHeader
        eyebrow={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Bell className="size-3.5" />
            Thông báo
          </div>
        }
        title="Lịch sử thông báo"
        description="Theo dõi toàn bộ thông báo hệ thống đã phát sinh từ payment, enrollment, payout và support."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Tổng bản ghi" value={loading ? '...' : items.length} hint="30 bản ghi mới nhất" />
        <AdminStatCard label="Gửi thành công" value={loading ? '...' : summary.sent} hint="Theo status trả về" tone="success" />
        <AdminStatCard label="Lỗi gửi" value={loading ? '...' : summary.failed} hint="Cần kiểm tra service log" tone={summary.failed > 0 ? 'danger' : 'default'} />
        <AdminStatCard label="Email" value={loading ? '...' : summary.email} hint="Kênh EMAIL" />
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      <Card className="glass-panel rounded-xl border-white/60">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách thông báo</CardTitle>
          <CardDescription>Dùng traceId/eventId để đối soát với service log khi có lỗi.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Đang tải thông báo...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/60 bg-white/40 p-8 text-center text-sm text-muted-foreground">
              Chưa có bản ghi thông báo nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Thông báo</th>
                    <th className="pb-3 pr-4">Loại</th>
                    <th className="pb-3 pr-4">Kênh</th>
                    <th className="pb-3 pr-4">Trạng thái</th>
                    <th className="pb-3 pr-4">Trace</th>
                    <th className="pb-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{item.type}</td>
                      <td className="py-3 pr-4">{item.channel}</td>
                      <td className="py-3 pr-4"><StatusBadge status={item.status} /></td>
                      <td className="py-3 pr-4">
                        <p className="font-mono text-xs text-muted-foreground">{item.traceId || item.eventId || '-'}</p>
                      </td>
                      <td className="whitespace-nowrap py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
