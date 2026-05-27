'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Search, Wallet, XCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { toast } from '@/components/ui/toast';
import { getAdminPayoutsAction, updateAdminPayoutAction, type AdminPayoutDto } from '@/app/actions/admin';

type PayoutAction = 'APPROVED' | 'REJECTED' | 'PAID';

export default function AdminPayoutsPage() {
  const [items, setItems] = useState<AdminPayoutDto[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    payout: AdminPayoutDto | null;
    nextStatus: PayoutAction | null;
  }>({ isOpen: false, payout: null, nextStatus: null });

  async function fetchPayouts() {
    setLoading(true);
    setError('');
    const result = await getAdminPayoutsAction({
      page,
      limit: 10,
      status: statusFilter || undefined,
      instructorId: instructorFilter.trim() || undefined,
    });
    if (result.success && result.data) {
      setItems(result.data.items);
      setPagination(result.data.pagination);
    } else {
      setError(result.message || 'Không thể tải danh sách yêu cầu rút tiền.');
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchPayouts();
  }, [page, statusFilter, instructorFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, instructorFilter]);

  const summary = useMemo(() => {
    const pending = items.filter((item) => item.status === 'PENDING').length;
    const approved = items.filter((item) => item.status === 'APPROVED').length;
    const amount = items.reduce((sum, item) => (item.status === 'PENDING' ? sum + item.amount : sum), 0);
    return { pending, approved, amount };
  }, [items]);

  function openUpdateConfirm(payout: AdminPayoutDto, nextStatus: PayoutAction) {
    if (nextStatus === 'REJECTED' && rejectReason.trim().length < 10) {
      toast('error', 'Thiếu lý do từ chối', 'Lý do từ chối cần ít nhất 10 ký tự để giảng viên hiểu cách xử lý tiếp.');
      return;
    }
    setConfirmDialog({ isOpen: true, payout, nextStatus });
  }

  async function submitUpdate() {
    if (!confirmDialog.payout || !confirmDialog.nextStatus) return;
    setActionLoading(true);
    const result = await updateAdminPayoutAction(
      confirmDialog.payout.id,
      confirmDialog.nextStatus,
      confirmDialog.nextStatus === 'REJECTED' ? rejectReason.trim() : undefined,
    );
    setActionLoading(false);

    if (!result.success) {
      toast('error', 'Cập nhật payout thất bại', result.message || 'Vui lòng thử lại.');
      return;
    }

    const successTitle =
      confirmDialog.nextStatus === 'REJECTED'
        ? 'Đã từ chối yêu cầu rút tiền'
        : confirmDialog.nextStatus === 'PAID'
          ? 'Đã đánh dấu chi trả'
          : 'Đã duyệt yêu cầu rút tiền';
    toast('success', successTitle, 'Thao tác đã được ghi audit log.');
    setRejectReason('');
    await fetchPayouts();
  }

  const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
  const dialogTitle =
    confirmDialog.nextStatus === 'REJECTED'
      ? 'Từ chối yêu cầu rút tiền'
      : confirmDialog.nextStatus === 'PAID'
        ? 'Xác nhận đã chi trả'
        : 'Duyệt yêu cầu rút tiền';

  return (
    <div className="workspace-page space-y-6">
      <AdminPageHeader
        eyebrow={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Wallet className="size-3.5" />
            Payout
          </div>
        }
        title="Quản lý rút tiền"
        description="Duyệt, từ chối hoặc xác nhận đã chi trả các yêu cầu rút tiền của giảng viên. Từ chối phải có lý do rõ ràng."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Đang chờ duyệt" value={loading ? '...' : summary.pending} hint="Trong trang hiện tại" tone={summary.pending > 0 ? 'warning' : 'default'} />
        <AdminStatCard label="Đã duyệt chờ chi" value={loading ? '...' : summary.approved} hint="Cần đối soát ngân hàng" />
        <AdminStatCard label="Số tiền chờ duyệt" value={loading ? '...' : formatMoney(summary.amount)} hint="Tổng PENDING đang hiển thị" />
        <AdminStatCard label="Tổng kết quả" value={pagination?.total ?? items.length} hint="Theo bộ lọc hiện tại" />
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      <Card className="glass-panel rounded-xl border-white/60">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg">Danh sách yêu cầu rút tiền</CardTitle>
              <CardDescription>Ưu tiên xử lý PENDING, sau đó đối soát các yêu cầu đã duyệt.</CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Lọc theo instructorId" className="pl-9" value={instructorFilter} onChange={(event) => setInstructorFilter(event.target.value)} />
              </div>
              <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ xử lý</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
                <option value="PAID">Đã chi trả</option>
              </select>
              <Input placeholder="Lý do từ chối payout" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Đang tải yêu cầu rút tiền...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/60 bg-white/40 p-8 text-center text-sm text-muted-foreground">
              Không có yêu cầu rút tiền phù hợp với bộ lọc hiện tại.
            </div>
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
                              <Button size="sm" className="gap-2 text-xs" disabled={actionLoading} onClick={() => openUpdateConfirm(payout, 'APPROVED')}>
                                <CheckCircle2 className="size-3" />
                                Duyệt
                              </Button>
                              <Button size="sm" variant="destructive" className="gap-2 text-xs" disabled={actionLoading} onClick={() => openUpdateConfirm(payout, 'REJECTED')}>
                                <XCircle className="size-3" />
                                Từ chối
                              </Button>
                            </>
                          )}
                          {payout.status === 'APPROVED' && (
                            <Button size="sm" variant="outline" className="text-xs" disabled={actionLoading} onClick={() => openUpdateConfirm(payout, 'PAID')}>
                              Đã chi trả
                            </Button>
                          )}
                          {!['PENDING', 'APPROVED'].includes(payout.status) && (
                            <span className="text-xs text-muted-foreground">Không còn thao tác</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 text-muted-foreground">{new Date(payout.createdAt).toLocaleString('vi-VN')}</td>
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Trước
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
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
        onConfirm={submitUpdate}
        title={dialogTitle}
        message={`Bạn có chắc muốn chuyển yêu cầu này sang trạng thái ${confirmDialog.nextStatus ?? ''}? Thao tác sẽ được ghi audit log và gửi thông báo liên quan nếu backend cấu hình.`}
        variant={confirmDialog.nextStatus === 'REJECTED' ? 'danger' : 'default'}
        confirmLabel={confirmDialog.nextStatus === 'REJECTED' ? 'Từ chối' : 'Xác nhận'}
        loading={actionLoading}
      />
    </div>
  );
}
