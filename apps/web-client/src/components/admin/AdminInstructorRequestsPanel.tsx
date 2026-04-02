'use client';

import { useEffect, useState } from 'react';
import {
  approveInstructorRequestAction,
  getInstructorRequestByIdAdminAction,
  getInstructorRequestStatsAction,
  listInstructorRequestsAdminAction,
  rejectInstructorRequestAction,
} from '@/app/actions/instructor';
import type { InstructorRequestDto } from '@/app/actions/instructor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { ArrowLeft, CheckCircle, ClipboardList, Loader2, XCircle } from 'lucide-react';

function statusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Chờ xem xét';
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Đã từ chối';
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/15 text-amber-800 border-amber-500/30';
    case 'approved':
      return 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30';
    case 'rejected':
      return 'bg-red-500/15 text-red-800 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap rounded-xl border border-white/50 bg-white/40 px-4 py-3 text-sm">{value}</p>
    </div>
  );
}

type AdminInstructorRequestsPanelProps = {
  requestId: string | null;
  onOpenDetail: (id: string) => void;
  onBackToList: () => void;
};

export function AdminInstructorRequestsPanel({ requestId, onOpenDetail, onBackToList }: AdminInstructorRequestsPanelProps) {
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number; rejected: number } | null>(null);
  const [requests, setRequests] = useState<InstructorRequestDto[]>([]);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState<InstructorRequestDto | null>(null);

  useEffect(() => {
    if (requestId) return;

    let cancelled = false;
    (async () => {
      setError('');
      setLoadingList(true);
      const [s, list] = await Promise.all([getInstructorRequestStatsAction(), listInstructorRequestsAdminAction()]);
      if (cancelled) return;
      if (!s.success) {
        setError(s.message || 'Không tải được thống kê.');
      } else if (s.stats) {
        setStats(s.stats);
      }
      if (!list.success) {
        setError((prev) => (prev ? `${prev} ` : '') + (list.message || 'Không tải được danh sách đơn.'));
      } else {
        setRequests(list.requests);
      }
      setLoadingList(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setDetail(null);
      setDetailError('');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      setDetailError('');
      const res = await getInstructorRequestByIdAdminAction(requestId);
      if (cancelled) return;
      if (!res.success || !res.request) {
        setDetailError(res.message || 'Không tìm thấy đơn.');
        setDetail(null);
      } else {
        setDetail(res.request);
      }
      setLoadingDetail(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const handleApprove = async () => {
    if (!requestId || !detail || detail.status !== 'pending') return;
    setActionLoading(true);
    setDetailError('');
    const res = await approveInstructorRequestAction(requestId);
    setActionLoading(false);
    if (!res.success) {
      setDetailError(res.message);
      return;
    }
    onBackToList();
  };

  const handleReject = async () => {
    if (!requestId || !detail || detail.status !== 'pending') return;
    setActionLoading(true);
    setDetailError('');
    const res = await rejectInstructorRequestAction(requestId);
    setActionLoading(false);
    if (!res.success) {
      setDetailError(res.message);
      return;
    }
    onBackToList();
  };

  if (requestId) {
    return (
      <div className="space-y-8">
        <ScrollReveal>
          <Button
            type="button"
            variant="ghost"
            className="w-fit gap-2 rounded-full px-0 font-semibold text-muted-foreground hover:text-primary"
            onClick={onBackToList}
          >
            <ArrowLeft className="size-4" />
            Danh sách đơn
          </Button>
        </ScrollReveal>

        {detailError && !detail && <StatusMessage type="error" message={detailError} />}

        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 size-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Đang tải chi tiết...</p>
          </div>
        ) : detail ? (
          <>
            {detailError && <StatusMessage type="error" message={detailError} />}
            <ScrollReveal>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{detail.fullName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Mã đơn: <span className="font-mono text-foreground">{detail.id}</span> · User ID:{' '}
                    <span className="font-mono text-foreground">{detail.userId}</span>
                  </p>
                </div>
                {detail.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={actionLoading}
                      className="gap-2 rounded-xl font-bold shadow-md"
                      onClick={handleApprove}
                    >
                      {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                      Duyệt
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={actionLoading}
                      className="gap-2 rounded-xl font-bold"
                      onClick={handleReject}
                    >
                      <XCircle className="size-4" />
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            </ScrollReveal>

            <Card className="glass-panel rounded-3xl border-white/60">
              <CardHeader>
                <CardTitle className="text-lg">Trạng thái</CardTitle>
                <CardDescription>
                  {detail.status === 'pending' && 'Đơn đang chờ xử lý.'}
                  {detail.status === 'approved' && 'Đã duyệt — tài khoản đã được nâng lên INSTRUCTOR.'}
                  {detail.status === 'rejected' && 'Đã từ chối đơn.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <Field label="Email" value={detail.email} />
                <Field label="Điện thoại" value={detail.phone} />
                <Field label="Chuyên môn" value={detail.expertise} />
                <Field label="Số năm kinh nghiệm" value={String(detail.experienceYears)} />
                <div className="md:col-span-2">
                  <Field label="Giới thiệu" value={detail.bio} />
                </div>
                <div className="md:col-span-2">
                  <Field label="Khóa học dự kiến — tiêu đề" value={detail.courseTitle} />
                </div>
                <Field label="Danh mục" value={detail.courseCategory} />
                <div className="md:col-span-2">
                  <Field label="Mô tả khóa học" value={detail.courseDescription} />
                </div>
                <Field label="GitHub" value={detail.github} />
                <Field label="LinkedIn" value={detail.linkedin} />
                <Field label="Website" value={detail.website} />
                <Field label="YouTube" value={detail.youtube} />
                <Field label="CV (URL)" value={detail.cvFile} />
                <Field label="Chứng chỉ (URL)" value={detail.certificateFile} />
                <Field label="CMND/CCCD (URL)" value={detail.identityCard} />
                <Field label="Ảnh đại diện (URL)" value={detail.avatar} />
                <div className="md:col-span-2 text-xs text-muted-foreground">
                  Gửi lúc: {new Date(detail.createdAt).toLocaleString('vi-VN')}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ScrollReveal>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-7 text-primary md:size-8" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Quản lý đơn đăng ký giảng viên</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
              Thống kê và xem xét hồ sơ học viên gửi lên. Chọn một đơn để xem chi tiết và duyệt hoặc từ chối.
            </p>
          </div>
        </div>
      </ScrollReveal>

      {error && <StatusMessage type="error" message={error} />}

      {loadingList ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-70">
          <Loader2 className="mb-4 size-10 animate-spin text-primary" />
          <p className="font-medium text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
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
                <ScrollReveal key={item.label}>
                  <Card className="glass-panel rounded-2xl border-white/60">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wide">{item.label}</CardDescription>
                      <CardTitle className={`text-3xl font-bold ${item.accent}`}>{item.value}</CardTitle>
                    </CardHeader>
                  </Card>
                </ScrollReveal>
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
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        Chưa có đơn nào.
                      </td>
                    </tr>
                  ) : (
                    requests.map((r) => (
                      <tr key={r.id} className="border-b border-white/40 transition-colors hover:bg-white/30">
                        <td className="px-4 py-3 font-semibold">{r.fullName}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">{r.email}</td>
                        <td className="max-w-[180px] truncate px-4 py-3">{r.expertise}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl font-semibold"
                            onClick={() => onOpenDetail(r.id)}
                          >
                            Chi tiết
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
