'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Play, RefreshCw, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  getAdminFailedEvent,
  getAdminFailedEvents,
  getAdminFailedEventStats,
  resolveAdminFailedEvent,
  retryAdminFailedEvent,
} from '@/app/actions/admin';

const TOPIC_OPTIONS = [
  'payment.order.completed',
  'payment.order.completed.retry-5s',
  'payment.order.completed.retry-1m',
  'learning.enrollment.created',
  'system.dead-letter',
];

export default function AdminSystemEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [payloadModal, setPayloadModal] = useState<{ isOpen: boolean; event: any | null }>({ isOpen: false, event: null });
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const [eventsRes, statsRes] = await Promise.all([
      getAdminFailedEvents({ page, limit: 10, status: statusFilter || undefined, topic: topicFilter || undefined }),
      getAdminFailedEventStats(),
    ]);
    if (eventsRes.success && eventsRes.data) {
      setEvents(eventsRes.data.events);
      setPagination(eventsRes.data.pagination);
    }
    if (statsRes.success) setStats(statsRes.data);
    setLoading(false);
  }, [page, statusFilter, topicFilter]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, topicFilter]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchEvents, 15000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchEvents]);

  async function handleViewPayload(eventId: string) {
    setPayloadLoading(true);
    setPayloadModal({ isOpen: true, event: null });
    const result = await getAdminFailedEvent(eventId);
    if (result.success && result.data) setPayloadModal({ isOpen: true, event: result.data });
    setPayloadLoading(false);
  }

  function handleRetry(eventId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Thá»­ láº¡i sá»± kiá»‡n',
      message: 'Báº¡n cÃ³ cháº¯c muá»‘n Ä‘Æ°a sá»± kiá»‡n nÃ y vÃ o luá»“ng xá»­ lÃ½ láº¡i?',
      variant: 'default',
      onConfirm: async () => {
        const result = await retryAdminFailedEvent(eventId);
        if (result.success) void fetchEvents();
      },
    });
  }

  async function handleResolve(eventId: string, status: string) {
    const result = await resolveAdminFailedEvent(eventId, status);
    if (result.success) void fetchEvents();
  }

  const pendingCount = stats?.pendingCount ?? 0;

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <h1 className="workspace-page-title">Sá»± kiá»‡n lá»—i há»‡ thá»‘ng</h1>
        <p className="workspace-page-description">
          Theo dÃµi vÃ  xá»­ lÃ½ cÃ¡c sá»± kiá»‡n tháº¥t báº¡i tá»« learning-service.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="size-5 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">
            CÃ³ <strong>{pendingCount}</strong> sá»± kiá»‡n Ä‘ang chá» xá»­ lÃ½.
          </p>
        </div>
      )}

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Sá»± kiá»‡n tháº¥t báº¡i</CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} className="rounded" />
                Tá»± Ä‘á»™ng lÃ m má»›i (15s)
              </label>
              <Button variant="outline" size="sm" onClick={fetchEvents}>
                <RefreshCw className="size-4" /> LÃ m má»›i
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
              <option value="PENDING">Chá» xá»­ lÃ½</option>
              <option value="RETRIED">ÄÃ£ thá»­ láº¡i</option>
              <option value="RESOLVED">ÄÃ£ xá»­ lÃ½</option>
              <option value="IGNORED">Bá» qua</option>
            </select>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
              <option value="">Táº¥t cáº£ topic</option>
              {TOPIC_OPTIONS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">KhÃ´ng cÃ³ sá»± kiá»‡n tháº¥t báº¡i nÃ o.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Topic</th>
                    <th className="pb-3 pr-4">Lá»—i</th>
                    <th className="pb-3 pr-4">Tráº¡ng thÃ¡i</th>
                    <th className="pb-3 pr-4">Thá»­ láº¡i</th>
                    <th className="pb-3 pr-4">NgÃ y táº¡o</th>
                    <th className="pb-3">HÃ nh Ä‘á»™ng</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium">{event.topic}</code>
                      </td>
                      <td className="max-w-[220px] truncate py-3 pr-4 text-muted-foreground">
                        {event.errorMessage || event.error || '-'}
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={event.status} /></td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">{event.retryCount ?? 0}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(event.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleViewPayload(event.id)}>
                            <Eye className="size-3" /> Xem
                          </Button>
                          {event.status === 'PENDING' && (
                            <>
                              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleRetry(event.id)}>
                                <Play className="size-3" /> Thá»­ láº¡i
                              </Button>
                              <select
                                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value=""
                                onChange={(selectEvent) => {
                                  if (selectEvent.target.value) void handleResolve(event.id, selectEvent.target.value);
                                }}
                              >
                                <option value="">Xá»­ lÃ½...</option>
                                <option value="RESOLVED">ÄÃ£ xá»­ lÃ½</option>
                                <option value="IGNORED">Bá» qua</option>
                              </select>
                            </>
                          )}
                        </div>
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
                  <ChevronLeft className="size-4" /> TrÆ°á»›c
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((prev) => prev + 1)}>
                  Sau <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {payloadModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPayloadModal({ isOpen: false, event: null })}>
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold">Chi tiáº¿t sá»± kiá»‡n</h3>
              <button onClick={() => setPayloadModal({ isOpen: false, event: null })} className="rounded-lg p-1 hover:bg-zinc-100" aria-label="ÄÃ³ng">
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {payloadLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RotateCcw className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : payloadModal.event ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Topic</p>
                      <code className="text-sm">{payloadModal.event.topic}</code>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Tráº¡ng thÃ¡i</p>
                      <StatusBadge status={payloadModal.event.status} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Láº§n thá»­</p>
                      <p>{payloadModal.event.retryCount ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">NgÃ y táº¡o</p>
                      <p>{new Date(payloadModal.event.createdAt).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>
                  {payloadModal.event.errorMessage && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Lá»—i</p>
                      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{payloadModal.event.errorMessage}</p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Payload</p>
                    <pre className="max-h-72 overflow-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-100">
                      {JSON.stringify(payloadModal.event.payload ?? payloadModal.event, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />
    </div>
  );
}


