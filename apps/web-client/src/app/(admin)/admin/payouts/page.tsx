'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { getAdminPayoutsAction, updateAdminPayoutAction, type AdminPayoutDto } from '@/app/actions/admin';

export default function AdminPayoutsPage() {
  const [items, setItems] = useState<AdminPayoutDto[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const fetchPayouts = async () => {
    setLoading(true);
    const res = await getAdminPayoutsAction({
      page,
      limit: 10,
      status: statusFilter || undefined,
      instructorId: instructorFilter.trim() || undefined,
    });
    if (res.success && res.data) {
      setItems(res.data.items);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchPayouts();
  }, [page, statusFilter, instructorFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, instructorFilter]);

  const handleUpdate = (payout: AdminPayoutDto, nextStatus: 'APPROVED' | 'REJECTED' | 'PAID') => {
    setConfirmDialog({
      isOpen: true,
      title: nextStatus === 'REJECTED' ? 'Từ chối payout' : nextStatus === 'PAID' ? 'Đánh dấu đã chi trả' : 'Duyệt payout',
      message: `Bạn có chắc muốn chuyển payout này sang trạng thái ${nextStatus}?`,
      variant: nextStatus === 'REJECTED' ? 'danger' : 'default',
      confirmLabel: nextStatus === 'REJECTED' ? 'Từ chối' : 'Xác nhận',
      onConfirm: async () => {
        setActionLoading(true);
        const res = await updateAdminPayoutAction(payout.id, nextStatus, note.trim() || undefined);
        setActionLoading(false);
        if (res.success) {
          setNote('');
          await fetchPayouts();
        }
      },
    });
  };

  const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý payout</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Duyệt hoặc từ chối các yêu cầu rút tiền của giảng viên.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Danh sách payout</CardTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Lọc theo instructorId"
                  className="pl-9"
                  value={instructorFilter}
                  onChange={(e) => setInstructorFilter(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAID">Paid</option>
              </select>
              <Input
                placeholder="Admin note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Đang tải payout...
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có payout nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Giảng viên</th>
                    <th className="pb-3 pr-4">Số tiền</th>
                    <th className="pb-3 pr-4">Tài khoản</th>
                    <th className="pb-3 pr-4">Trạng thái</th>
                    <th className="pb-3 pr-4">Xử lý</th>
                    <th className="pb-3">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((payout) => (
                    <tr key={payout.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <p className="font-medium">{payout.instructorName || payout.instructorId}</p>
                          <p className="text-xs text-muted-foreground">{payout.instructorEmail || payout.instructorId}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{formatMoney(payout.amount)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{payout.bankAccountMasked}</td>
                      <td className="py-3 pr-4"><StatusBadge status={payout.status} /></td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {payout.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                className="gap-2 text-xs"
                                disabled={actionLoading}
                                onClick={() => handleUpdate(payout, 'APPROVED')}
                              >
                                <CheckCircle2 className="size-3" />
                                Duyệt
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-2 text-xs"
                                disabled={actionLoading}
                                onClick={() => handleUpdate(payout, 'REJECTED')}
                              >
                                <XCircle className="size-3" />
                                Từ chối
                              </Button>
                            </>
                          )}
                          {payout.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={actionLoading}
                              onClick={() => handleUpdate(payout, 'PAID')}
                            >
                              Đánh dấu đã chi trả
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 text-muted-foreground">
                        {new Date(payout.createdAt).toLocaleString('vi-VN')}
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
      />
    </div>
  );
}
