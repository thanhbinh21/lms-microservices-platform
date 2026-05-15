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
    <div className="workspace-page">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="workspace-page-title">Nháº­t kÃ½ hoáº¡t Ä‘á»™ng</h1>
          <p className="workspace-page-description">
            Theo dÃµi cÃ¡c hÃ nh Ä‘á»™ng nháº¡y cáº£m cá»§a admin vÃ  cÃ¡c service ná»™i bá»™.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void fetchLogs()}>
          <RefreshCw className="size-4" />
          LÃ m má»›i
        </Button>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sÃ¡ch nháº­t kÃ½ hoáº¡t Ä‘á»™ng</CardTitle>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Lá»c theo hÃ nh Ä‘á»™ng"
                className="pl-9"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <Input
              placeholder="Lá»c theo loáº¡i tÃ i nguyÃªn"
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
            />
            <Input
              placeholder="Lá»c theo ID ngÆ°á»i dÃ¹ng"
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
            <p className="py-8 text-center text-sm text-muted-foreground">ChÆ°a cÃ³ audit log nÃ o.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">NgÆ°á»i thá»±c hiá»‡n</th>
                    <th className="pb-3 pr-4">HÃ nh Ä‘á»™ng</th>
                    <th className="pb-3 pr-4">TÃ i nguyÃªn</th>
                    <th className="pb-3 pr-4">Dá»¯ liá»‡u</th>
                    <th className="pb-3 pr-4">Trace ID</th>
                    <th className="pb-3">Thá»i gian</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id} className="border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <p className="font-medium">{log.actorName || log.actorId}</p>
                          <p className="text-xs text-muted-foreground">{log.actorRole}{log.actorEmail ? ` Â· ${log.actorEmail}` : ''}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{log.action}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        <div className="space-y-1">
                          <p>{log.resourceType || 'â€”'}</p>
                          <p className="font-mono text-xs">{log.resourceId || 'â€”'}</p>
                          <p>{log.targetLabel || 'â€”'}</p>
                        </div>
                      </td>
                      <td className="max-w-[280px] py-3 pr-4 text-xs text-muted-foreground">
                        <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-100">
                          {JSON.stringify(log.payload ?? {}, null, 2)}
                        </pre>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{log.traceId || 'â€”'}</td>
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
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} káº¿t quáº£)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  TrÆ°á»›c
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


