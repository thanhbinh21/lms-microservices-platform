'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAdminAuditLogsAction, type AdminAuditLogDto } from '@/app/actions/admin';

export default function AdminAuditLogPage() {
  const [items, setItems] = useState<AdminAuditLogDto[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    const res = await getAdminAuditLogsAction({
      page,
      limit: 20,
      action: actionFilter || undefined,
      resourceType: resourceTypeFilter || undefined,
      actorId: actorFilter || undefined,
    });
    if (res.success && res.data) {
      setItems(res.data.items);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchLogs();
  }, [page, actionFilter, resourceTypeFilter, actorFilter]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, resourceTypeFilter, actorFilter]);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nhật ký kiểm toán</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Theo dõi các hành động nhạy cảm của admin và các service nội bộ.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void fetchLogs()}>
          <RefreshCw className="size-4" />
          Làm mới
        </Button>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách nhật ký kiểm toán</CardTitle>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Lọc theo hành động"
                className="pl-9"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <Input
              placeholder="Lọc theo loại tài nguyên"
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
            />
            <Input
              placeholder="Lọc theo ID người dùng"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có audit log nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Người thực hiện</th>
                    <th className="pb-3 pr-4">Hành động</th>
                    <th className="pb-3 pr-4">Tài nguyên</th>
                    <th className="pb-3 pr-4">Dữ liệu</th>
                    <th className="pb-3 pr-4">Trace ID</th>
                    <th className="pb-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id} className="border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <p className="font-medium">{log.actorName || log.actorId}</p>
                          <p className="text-xs text-muted-foreground">{log.actorRole}{log.actorEmail ? ` · ${log.actorEmail}` : ''}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{log.action}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        <div className="space-y-1">
                          <p>{log.resourceType || '—'}</p>
                          <p className="font-mono text-xs">{log.resourceId || '—'}</p>
                          <p>{log.targetLabel || '—'}</p>
                        </div>
                      </td>
                      <td className="max-w-[280px] py-3 pr-4 text-xs text-muted-foreground">
                        <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-100">
                          {JSON.stringify(log.payload ?? {}, null, 2)}
                        </pre>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{log.traceId || '—'}</td>
                      <td className="whitespace-nowrap py-3 text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} kết quả)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
