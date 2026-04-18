'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  X,
  RotateCcw,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  getAdminFailedEvents,
  getAdminFailedEventStats,
  getAdminFailedEvent,
  retryAdminFailedEvent,
  resolveAdminFailedEvent,
} from '@/app/actions/admin';

export default function AdminSystemDLQPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [payloadModal, setPayloadModal] = useState<{ isOpen: boolean; event: any | null }>({
    isOpen: false,
    event: null,
  });
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
      getAdminFailedEvents({
        page,
        limit: 10,
        status: statusFilter || undefined,
        topic: topicFilter || undefined,
      }),
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
    fetchEvents();
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

  const handleViewPayload = async (eventId: string) => {
    setPayloadLoading(true);
    setPayloadModal({ isOpen: true, event: null });
    const res = await getAdminFailedEvent(eventId);
    if (res.success && res.data) {
      setPayloadModal({ isOpen: true, event: res.data });
    }
    setPayloadLoading(false);
  };

  const handleRetry = (eventId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Thử lại sự kiện',
      message: 'Bạn có chắc muốn thử lại xử lý sự kiện này?',
      variant: 'default',
      onConfirm: async () => {
        const res = await retryAdminFailedEvent(eventId);
        if (res.success) fetchEvents();
      },
    });
  };

  const handleResolve = async (eventId: string, status: string) => {
    const res = await resolveAdminFailedEvent(eventId, status);
    if (res.success) fetchEvents();
  };

  const pendingCount = stats?.pendingCount ?? 0;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Hệ thống DLQ</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Theo dõi và xử lý các sự kiện thất bại (Dead Letter Queue).
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="size-5 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">
            Có <strong>{pendingCount}</strong> sự kiện đang chờ xử lý (PENDING).
          </p>
        </div>
      )}

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Failed Events</CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Tự động làm mới (15s)
              </label>
              <Button variant="outline" size="sm" onClick={fetchEvents}>
                <RefreshCw className="size-4" /> Làm mới
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Pending</option>
              <option value="RETRIED">Retried</option>
              <option value="RESOLVED">Resolved</option>
              <option value="IGNORED">Ignored</option>
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
            >
              <option value="">Tất cả topic</option>
              <option value="user-registered">user-registered</option>
              <option value="course-enrolled">course-enrolled</option>
              <option value="payment-completed">payment-completed</option>
              <option value="order-created">order-created</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Không có sự kiện thất bại nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Topic</th>
                    <th className="pb-3 pr-4">Lỗi</th>
                    <th className="pb-3 pr-4">Trạng thái</th>
                    <th className="pb-3 pr-4">Thử lại</th>
                    <th className="pb-3 pr-4">Ngày tạo</th>
                    <th className="pb-3">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium">
                          {ev.topic}
                        </code>
                      </td>
                      <td className="max-w-[200px] truncate py-3 pr-4 text-muted-foreground">
                        {ev.errorMessage || ev.error || '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={ev.status} />
                      </td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">
                        {ev.retryCount ?? 0}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(ev.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleViewPayload(ev.id)}
                          >
                            <Eye className="size-3" /> Xem
                          </Button>
                          {ev.status === 'PENDING' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleRetry(ev.id)}
                              >
                                <Play className="size-3" /> Thử lại
                              </Button>
                              <select
                                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleResolve(ev.id, e.target.value);
                                }}
                              >
                                <option value="">Xử lý...</option>
                                <option value="RESOLVED">Resolved</option>
                                <option value="IGNORED">Ignored</option>
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
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} kết quả)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" /> Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {payloadModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setPayloadModal({ isOpen: false, event: null })}
        >
          <div
            className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold">Chi tiết sự kiện</h3>
              <button
                onClick={() => setPayloadModal({ isOpen: false, event: null })}
                className="rounded-lg p-1 hover:bg-zinc-100"
              >
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
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Trạng thái</p>
                      <StatusBadge status={payloadModal.event.status} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Lần thử</p>
                      <p>{payloadModal.event.retryCount ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Ngày tạo</p>
                      <p>{new Date(payloadModal.event.createdAt).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>
                  {payloadModal.event.errorMessage && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Lỗi</p>
                      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {payloadModal.event.errorMessage}
                      </p>
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
                <p className="py-8 text-center text-sm text-muted-foreground">Không tải được dữ liệu.</p>
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
