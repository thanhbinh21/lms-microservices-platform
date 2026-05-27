'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  approveInstructorRequestAction,
  getInstructorRequestByIdAdminAction,
  getInstructorRequestStatsAction,
  listInstructorRequestsAdminAction,
  rejectInstructorRequestAction,
  type InstructorRequestDto,
} from '@/app/actions/instructor';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import { toast } from '@/components/ui/toast';
import { ArrowLeft, CheckCircle, ClipboardList, Loader2, XCircle } from 'lucide-react';

type AdminInstructorRequestsPanelProps = {
  requestId: string | null;
  onOpenDetail: (id: string) => void;
  onBackToList: () => void;
};

function normalizeStatus(status?: string | null) {
  return (status || '').toUpperCase();
}

function statusLabel(status?: string | null) {
  switch (normalizeStatus(status)) {
    case 'PENDING':
      return 'Chờ xem xét';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'REJECTED':
      return 'Đã từ chối';
    default:
      return status || '-';
  }
}

function statusClass(status?: string | null) {
  switch (normalizeStatus(status)) {
    case 'PENDING':
      return 'bg-amber-500/15 text-amber-800 border-amber-500/30';
    case 'APPROVED':
      return 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30';
    case 'REJECTED':
      return 'bg-red-500/15 text-red-800 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap rounded-xl border border-white/50 bg-white/40 px-4 py-3 text-sm">{value}</p>
    </div>
  );
}

export function AdminInstructorRequestsPanel({ requestId, onOpenDetail, onBackToList }: AdminInstructorRequestsPanelProps) {
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<InstructorRequestDto[]>([]);
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number; rejected: number } | null>(null);

  const [detail, setDetail] = useState<InstructorRequestDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; mode: 'approve' | 'reject' | null }>({ isOpen: false, mode: null });

  async function loadList() {
    setLoadingList(true);
    setError('');
    const [statsRes, listRes] = await Promise.all([
      getInstructorRequestStatsAction(),
      listInstructorRequestsAdminAction(),
    ]);

    if (!statsRes.success || !statsRes.stats) {
      setError(statsRes.message || 'Không tải được thống kê đơn đăng ký giảng viên.');
      setStats(null);
    } else {
      setStats(statsRes.stats);
    }

    if (!listRes.success) {
      setError((prev) => {
        const listError = listRes.message || 'Không tải được danh sách đơn.';
        return prev ? `${prev} ${listError}` : listError;
      });
      setRequests([]);
    } else {
      setRequests(listRes.requests);
    }
    setLoadingList(false);
  }

  useEffect(() => {
    if (!requestId) void loadList();
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setDetail(null);
      setDetailError('');
      setRejectReason('');
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setDetailError('');
      const result = await getInstructorRequestByIdAdminAction(requestId as string);
      if (cancelled) return;
      if (!result.success || !result.request) {
        setDetailError(result.message || 'Không tìm thấy đơn đăng ký.');
        setDetail(null);
      } else {
        setDetail(result.request);
        setRejectReason(result.request.rejectionReason || '');
      }
      setLoadingDetail(false);
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const canReview = useMemo(() => normalizeStatus(detail?.status) === 'PENDING', [detail?.status]);

  const handleApprove = async () => {
    if (!requestId || !detail || !canReview) return;
    setActionLoading(true);
    setDetailError('');
    const result = await approveInstructorRequestAction(requestId);
    setActionLoading(false);
    if (!result.success) {
      const message = result.message || 'Duyệt đơn thất bại.';
      setDetailError(message);
      toast('error', 'Duyệt thất bại', message);
      return;
    }
    toast('success', 'Đã duyệt đơn', `${detail.fullName} đã trở thành giảng viên.`);
    onBackToList();
  };

  const handleReject = async () => {
    if (!requestId || !detail || !canReview) return;
    const reason = rejectReason.trim();
    if (reason.length < 10) {
      const message = 'Lý do từ chối phải có ít nhất 10 ký tự.';
      setDetailError(message);
      toast('error', 'Thiếu lý do', message);
      return;
    }

    setActionLoading(true);
    setDetailError('');
    const result = await rejectInstructorRequestAction(requestId, reason);
    setActionLoading(false);
    if (!result.success) {
      const message = result.message || 'Từ chối đơn thất bại.';
      setDetailError(message);
      toast('error', 'Từ chối thất bại', message);
      return;
    }
    toast('info', 'Đã từ chối đơn', `${detail.fullName} đã được thông báo.`);
    onBackToList();
  };

  const openRejectConfirm = () => {
    if (rejectReason.trim().length < 10) {
      const message = 'Lý do từ chối phải có ít nhất 10 ký tự.';
      setDetailError(message);
      toast('error', 'Thiếu lý do', message);
      return;
    }
    setConfirmDialog({ isOpen: true, mode: 'reject' });
  };

  if (requestId) {
    return (
      <div className="space-y-8">
        <Button type="button" variant="ghost" className="w-fit gap-2 rounded-full px-0 font-semibold text-muted-foreground hover:text-primary" onClick={onBackToList}>
          <ArrowLeft className="size-4" />
          Danh sách đơn
        </Button>

        {detailError && !detail && <StatusMessage type="error" message={detailError} />}

        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 size-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Đang tải chi tiết đơn...</p>
          </div>
        ) : detail ? (
          <>
            {detailError && <StatusMessage type="error" message={detailError} />}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{detail.fullName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mã đơn: <span className="font-mono text-foreground">{detail.id}</span> · User ID:{' '}
                  <span className="font-mono text-foreground">{detail.userId}</span>
                </p>
                <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(detail.status)}`}>{statusLabel(detail.status)}</span>
              </div>

              {canReview && (
                <div className="flex w-full flex-col gap-3 sm:w-auto">
                  <div className="sm:max-w-sm">
                    <label htmlFor="reject-reason" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Lý do từ chối
                    </label>
                    <textarea
                      id="reject-reason"
                      rows={3}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Nhập lý do để học viên bổ sung hồ sơ..."
                      className="w-full resize-none rounded-xl border border-white/50 bg-white/60 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={actionLoading} className="gap-2 rounded-xl font-bold shadow-md" onClick={() => setConfirmDialog({ isOpen: true, mode: 'approve' })}>
                      {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                      Duyệt
                    </Button>
                    <Button type="button" variant="destructive" disabled={actionLoading} className="gap-2 rounded-xl font-bold" onClick={openRejectConfirm}>
                      <XCircle className="size-4" />
                      Từ chối
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Card className="glass-panel rounded-3xl border-white/60">
              <CardHeader>
                <CardTitle className="text-lg">Thông tin hồ sơ</CardTitle>
                <CardDescription>
                  {normalizeStatus(detail.status) === 'PENDING' && 'Đơn đang chờ admin xử lý.'}
                  {normalizeStatus(detail.status) === 'APPROVED' && 'Đơn đã được duyệt và tài khoản đã nâng quyền INSTRUCTOR.'}
                  {normalizeStatus(detail.status) === 'REJECTED' && 'Đơn đã bị từ chối. Lý do hiển thị cho học viên.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <Field label="Email" value={detail.email} />
                <Field label="Điện thoại" value={detail.phone} />
                <Field label="Chuyên môn" value={detail.expertise} />
                <Field label="Số năm kinh nghiệm" value={detail.experienceYears} />
                <div className="md:col-span-2"><Field label="Giới thiệu" value={detail.bio} /></div>
                <div className="md:col-span-2"><Field label="Tên khóa học dự kiến" value={detail.courseTitle} /></div>
                <Field label="Danh mục" value={detail.courseCategory} />
                <Field label="Đối tượng học viên" value={detail.targetStudents} />
                <div className="md:col-span-2"><Field label="Mô tả khóa học" value={detail.courseDescription} /></div>
                {detail.rejectionReason && <div className="md:col-span-2"><Field label="Lý do từ chối" value={detail.rejectionReason} /></div>}
                <Field label="GitHub" value={detail.github} />
                <Field label="LinkedIn" value={detail.linkedin} />
                <Field label="Website" value={detail.website} />
                <Field label="YouTube" value={detail.youtube} />
                <Field label="CV (URL)" value={detail.cvFile} />
                <Field label="Chứng chỉ (URL)" value={detail.certificateFile} />
                <Field label="CMND/CCCD (URL)" value={detail.identityCard} />
                <Field label="Ảnh đại diện (URL)" value={detail.avatar} />
                <div className="text-xs text-muted-foreground md:col-span-2">
                  Gửi lúc: {new Date(detail.createdAt).toLocaleString('vi-VN')}
                </div>
              </CardContent>
            </Card>

            <ConfirmDialog
              isOpen={confirmDialog.isOpen}
              onClose={() => setConfirmDialog({ isOpen: false, mode: null })}
              onConfirm={confirmDialog.mode === 'reject' ? handleReject : handleApprove}
              title={confirmDialog.mode === 'reject' ? 'Từ chối đơn giảng viên' : 'Duyệt đơn giảng viên'}
              message={
                confirmDialog.mode === 'reject'
                  ? 'Bạn có chắc muốn từ chối đơn này? Lý do từ chối sẽ được lưu và hiển thị cho học viên.'
                  : 'Bạn có chắc muốn duyệt đơn này và nâng quyền tài khoản thành giảng viên?'
              }
              variant={confirmDialog.mode === 'reject' ? 'danger' : 'default'}
              confirmLabel={confirmDialog.mode === 'reject' ? 'Từ chối' : 'Duyệt'}
              loading={actionLoading}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ClipboardList className="size-7 text-primary md:size-8" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Quản lý đơn đăng ký giảng viên</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
            Xem thống kê và xử lý hồ sơ học viên gửi đăng ký trở thành giảng viên.
          </p>
        </div>
      </div>

      {error && <StatusMessage type="error" message={error} />}

      {loadingList ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-70">
          <Loader2 className="mb-4 size-10 animate-spin text-primary" />
          <p className="font-medium text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      ) : error ? (
        <Card className="glass-panel rounded-3xl border-white/60">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-semibold text-destructive">Không thể tải danh sách đơn</p>
            <p className="mt-1 text-xs text-muted-foreground">Không hiển thị empty state khi API lỗi để tránh hiểu nhầm là không có đơn.</p>
            <Button className="mt-4 rounded-xl font-bold" onClick={() => void loadList()}>Thử tải lại</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Tổng đơn', value: stats.total, accent: 'text-primary' },
                { label: 'Chờ xem xét', value: stats.pending, accent: 'text-amber-600' },
                { label: 'Đã duyệt', value: stats.approved, accent: 'text-emerald-600' },
                { label: 'Đã từ chối', value: stats.rejected, accent: 'text-red-600' },
              ].map((item) => (
                <Card key={item.label} className="glass-panel rounded-2xl border-white/60">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wide">{item.label}</CardDescription>
                    <CardTitle className={`text-3xl font-bold ${item.accent}`}>{item.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          <Card className="glass-panel overflow-hidden rounded-3xl border-white/60">
            <CardHeader>
              <CardTitle className="text-xl">Danh sách đơn</CardTitle>
              <CardDescription>Sắp xếp theo thời gian gửi mới nhất.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/50 bg-white/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Họ tên</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Chuyên môn</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Gửi lúc</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Chưa có đơn nào.</td>
                    </tr>
                  ) : requests.map((request) => (
                    <tr key={request.id} className="border-b border-white/40 transition-colors hover:bg-white/30">
                      <td className="px-4 py-3 font-semibold">{request.fullName}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">{request.email}</td>
                      <td className="max-w-[180px] truncate px-4 py-3">{request.expertise}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(request.status)}`}>
                          {statusLabel(request.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(request.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" size="sm" variant="outline" className="rounded-xl font-semibold" onClick={() => onOpenDetail(request.id)}>
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
