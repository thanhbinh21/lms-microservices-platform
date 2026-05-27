'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  Bell,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { StatusMessage } from '@/components/ui/status-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  createInstructorPayoutAction,
  getInstructorEarningsAction,
  getInstructorEarningsSummaryAction,
  getInstructorPayoutProfileAction,
  getMyInstructorPayoutsAction,
  saveInstructorPayoutProfileAction,
  type InstructorEarningDto,
  type InstructorEarningsSummary,
  type InstructorPayoutDto,
} from '@/app/actions/instructor';

const PAYOUT_STATUS_LABEL: Record<InstructorPayoutDto['status'], string> = {
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  PAID: 'Đã chi trả',
};

const PAYOUT_STATUS_CLASS: Record<InstructorPayoutDto['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  PAID: 'bg-emerald-100 text-emerald-700',
};

function formatVND(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

function validateBankProfile(params: { bankAccount: string; bankName: string; accountHolder: string }) {
  const bankAccount = params.bankAccount.trim();
  if (!/^[0-9]{8,20}$/.test(bankAccount)) {
    return 'Số tài khoản chỉ gồm 8-20 chữ số.';
  }
  if (params.bankName.trim().length < 2) {
    return 'Tên ngân hàng phải có ít nhất 2 ký tự.';
  }
  if (params.accountHolder.trim().length < 2) {
    return 'Tên chủ tài khoản phải có ít nhất 2 ký tự.';
  }
  return '';
}

export default function InstructorChannelSettingsPage() {
  const [summary, setSummary] = useState<InstructorEarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<InstructorEarningDto[]>([]);
  const [payouts, setPayouts] = useState<InstructorPayoutDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankAccountMasked, setBankAccountMasked] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');

  async function loadData() {
    setLoading(true);
    setLoadError('');
    const [summaryRes, earningsRes, profileRes, payoutsRes] = await Promise.all([
      getInstructorEarningsSummaryAction(),
      getInstructorEarningsAction(),
      getInstructorPayoutProfileAction(),
      getMyInstructorPayoutsAction(),
    ]);

    if (!summaryRes.success) {
      setLoadError(summaryRes.message || 'Không thể tải dữ liệu doanh thu.');
    }
    if (summaryRes.success && summaryRes.data) {
      setSummary(summaryRes.data);
      setPayoutAmount(summaryRes.data.availableBalance > 0 ? String(Math.floor(summaryRes.data.availableBalance)) : '');
    }
    if (earningsRes.success && earningsRes.data) setEarnings(earningsRes.data);
    if (payoutsRes.success && payoutsRes.data) setPayouts(payoutsRes.data);
    if (profileRes.success && profileRes.data) {
      setBankName(profileRes.data.bankName);
      setAccountHolder(profileRes.data.accountHolder);
      setBankAccountMasked(profileRes.data.bankAccountMasked);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const hasPendingPayout = useMemo(() => payouts.some((item) => item.status === 'PENDING'), [payouts]);
  const parsedPayoutAmount = Number(payoutAmount || 0);
  const latestShare = earnings.find((earning) => earning.revenueSharePct > 0 || earning.platformFeePct > 0);
  const instructorSharePct = latestShare?.revenueSharePct ? Math.round(latestShare.revenueSharePct * 100) : 70;
  const platformSharePct = latestShare?.platformFeePct ? Math.round(latestShare.platformFeePct * 100) : 100 - instructorSharePct;
  const recentEarnings = earnings.slice(0, 5);
  const payoutBlockReason = useMemo(() => {
    if (!summary || summary.availableBalance <= 0) return 'Chưa có số dư khả dụng để rút.';
    if (!bankAccountMasked) return 'Vui lòng lưu thông tin ngân hàng trước khi rút tiền.';
    if (hasPendingPayout) return 'Bạn đang có một yêu cầu rút tiền chờ xử lý.';
    if (!Number.isFinite(parsedPayoutAmount) || parsedPayoutAmount <= 0) return 'Nhập số tiền muốn rút lớn hơn 0.';
    if (parsedPayoutAmount > summary.availableBalance) return 'Số tiền rút không được vượt quá số dư khả dụng.';
    return '';
  }, [bankAccountMasked, hasPendingPayout, parsedPayoutAmount, summary]);
  const canRequestPayout = !payoutBlockReason && !requestingPayout;

  async function savePayoutProfile() {
    setStatusMessage(null);
    const validationMessage = validateBankProfile({ bankAccount, bankName, accountHolder });
    if (validationMessage) {
      setStatusMessage({ type: 'error', message: validationMessage });
      toast('error', 'Thông tin ngân hàng chưa hợp lệ', validationMessage);
      return;
    }

    setSaving(true);
    try {
      const result = await saveInstructorPayoutProfileAction({
        bankAccount: bankAccount.trim(),
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
      });
      if (result.success && result.data) {
        setStatusMessage({ type: 'success', message: 'Đã lưu thông tin nhận thanh toán.' });
        toast('success', 'Đã lưu thông tin nhận thanh toán');
        setBankAccount('');
        setBankAccountMasked(result.data.bankAccountMasked);
      } else {
        const message = result.message || 'Không thể lưu thông tin nhận thanh toán.';
        setStatusMessage({ type: 'error', message });
        toast('error', 'Lưu thông tin thất bại', message);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setStatusMessage({ type: 'error', message });
      toast('error', 'Lưu thông tin thất bại', message);
    } finally {
      setSaving(false);
    }
  }

  async function requestPayout() {
    if (!canRequestPayout) return;
    setStatusMessage(null);
    setRequestingPayout(true);
    try {
      const result = await createInstructorPayoutAction(parsedPayoutAmount);
      if (result.success) {
        setStatusMessage({ type: 'success', message: 'Đã tạo yêu cầu rút tiền. Admin sẽ xử lý và cập nhật trạng thái tại đây.' });
        toast('success', 'Đã tạo yêu cầu rút tiền');
        await loadData();
      } else {
        const message = result.message || 'Không thể tạo yêu cầu rút tiền.';
        setStatusMessage({ type: 'error', message });
        toast('error', 'Tạo yêu cầu rút tiền thất bại', message);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setStatusMessage({ type: 'error', message });
      toast('error', 'Tạo yêu cầu rút tiền thất bại', message);
    } finally {
      setRequestingPayout(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Wallet className="size-3.5" />
            Doanh thu & thanh toán
          </div>
          <h1 className="workspace-page-title">Kênh thanh toán</h1>
          <p className="workspace-page-description">
            Theo dõi thu nhập từ đơn hàng, quản lý tài khoản nhận tiền và gửi yêu cầu rút số dư khả dụng.
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-xl font-semibold" onClick={() => void loadData()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Làm mới
        </Button>
      </div>

      <div className="mx-auto max-w-5xl space-y-6">
        {statusMessage && <StatusMessage type={statusMessage.type} message={statusMessage.message} />}
        {loadError && <StatusMessage type="error" message={loadError} />}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Số dư khả dụng', value: summary ? formatVND(summary.availableBalance) : '...', hint: 'Có thể gửi yêu cầu rút', highlight: true },
            { label: 'Đã rút', value: summary ? formatVND(summary.withdrawnBalance) : '...', hint: 'Payout đã chi trả' },
            { label: 'Tổng thu nhập', value: summary ? formatVND(summary.totalEarned) : '...', hint: 'Net earning sau phí' },
            { label: 'Đơn hàng', value: summary ? summary.totalOrders.toLocaleString('vi-VN') : '...', hint: 'Đơn đã hoàn tất' },
          ].map((stat) => (
            <Card key={stat.label} className={`rounded-2xl border-white/60 bg-white/50 backdrop-blur-md ${stat.highlight ? 'border-emerald-200/70' : ''}`}>
              <CardHeader className="pb-2">
                <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
                <CardTitle className={`text-2xl font-bold ${stat.highlight ? 'text-emerald-600' : ''}`}>{loading ? '...' : stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle className="text-base">Luồng thu nhập</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Mỗi đơn hàng hoàn tất sẽ tạo earning. Khi earning ở trạng thái khả dụng, bạn có thể gửi yêu cầu payout.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              ['1', 'Đơn hàng hoàn tất', 'Học viên thanh toán thành công.'],
              ['2', 'Ghi nhận earning', `Giảng viên nhận ${instructorSharePct}%, nền tảng giữ ${platformSharePct}%.`],
              ['3', 'Số dư khả dụng', 'Khoản đủ điều kiện sẽ cộng vào balance.'],
              ['4', 'Yêu cầu rút tiền', 'Admin duyệt, từ chối hoặc đánh dấu đã chi trả.'],
            ].map(([step, title, description]) => (
              <div key={step} className="rounded-xl border border-slate-200/70 bg-white/60 p-3">
                <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{step}</div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <CardTitle className="text-base">Thông tin nhận thanh toán</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Tài khoản ngân hàng được dùng khi admin xử lý payout. Số tài khoản đầy đủ chỉ gửi qua API khi bạn lưu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bankAccountMasked ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  Đang lưu: {bankName} - {bankAccountMasked} - {accountHolder}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Bạn cần lưu thông tin ngân hàng trước khi rút tiền.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="bank-account" className="text-xs font-bold text-muted-foreground">Số tài khoản</label>
                  <Input
                    id="bank-account"
                    inputMode="numeric"
                    placeholder="VD: 1234567890"
                    value={bankAccount}
                    onChange={(event) => setBankAccount(event.target.value.replace(/\D/g, ''))}
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">8-20 chữ số, không nhập dấu cách.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="bank-name" className="text-xs font-bold text-muted-foreground">Tên ngân hàng</label>
                  <Input id="bank-name" placeholder="VD: Vietcombank" value={bankName} onChange={(event) => setBankName(event.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="account-holder" className="text-xs font-bold text-muted-foreground">Tên chủ tài khoản</label>
                  <Input
                    id="account-holder"
                    placeholder="VD: NGUYEN VAN A"
                    value={accountHolder}
                    onChange={(event) => setAccountHolder(event.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="rounded-xl font-bold"
                onClick={savePayoutProfile}
                disabled={saving || !bankAccount || !bankName.trim() || !accountHolder.trim()}
              >
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
                Lưu thông tin ngân hàng
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-primary" />
                <CardTitle className="text-base">Gửi yêu cầu rút tiền</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Chính sách hiện tại chỉ cho phép một yêu cầu chờ xử lý tại một thời điểm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200/70 bg-white/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tối đa có thể rút</p>
                <p className="text-2xl font-bold text-emerald-600">{summary ? formatVND(summary.availableBalance) : '...'}</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="payout-amount" className="text-xs font-bold text-muted-foreground">Số tiền muốn rút</label>
                <Input
                  id="payout-amount"
                  type="number"
                  min={0}
                  max={summary?.availableBalance ?? 0}
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  placeholder="Nhập số tiền"
                  className="rounded-xl"
                />
              </div>
              {payoutBlockReason && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {payoutBlockReason}
                </div>
              )}
              <Button type="button" className="w-full rounded-xl font-bold" disabled={!canRequestPayout} onClick={() => setConfirmOpen(true)}>
                {requestingPayout ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowDownToLine className="mr-2 size-4" />}
                Gửi yêu cầu rút tiền
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-primary" />
                <CardTitle className="text-base">Lịch sử rút tiền</CardTitle>
              </div>
              <CardDescription className="text-xs">Nếu yêu cầu bị từ chối, lý do từ admin sẽ hiển thị ngay dưới giao dịch.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang tải lịch sử payout...
                </div>
              ) : payouts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-white/40 py-10 text-center">
                  <p className="text-sm font-semibold">Chưa có yêu cầu rút tiền</p>
                  <p className="mt-1 text-xs text-muted-foreground">Khi có số dư khả dụng, hãy gửi payout để admin xử lý.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200/70">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Số tiền</th>
                        <th className="px-4 py-3">Ngày gửi</th>
                        <th className="px-4 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/60">
                      {payouts.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 align-top">
                            <p className="font-semibold">{formatVND(item.amount)}</p>
                            <p className="text-[11px] text-muted-foreground">{item.bankAccountMasked}</p>
                            {item.adminNote && <p className="mt-1 text-[11px] font-medium text-rose-600">Lý do/Ghi chú: {item.adminNote}</p>}
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                          <td className="px-4 py-3 align-top">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PAYOUT_STATUS_CLASS[item.status]}`}>
                              {PAYOUT_STATUS_LABEL[item.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base">Earning gần đây</CardTitle>
              <CardDescription className="text-xs">Danh sách khoản thu net từ các đơn hàng đã hoàn tất.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Đang tải earning...</p>
              ) : recentEarnings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-white/40 p-5 text-sm text-muted-foreground">
                  Chưa có earning nào. Khi học viên thanh toán khóa học của bạn, khoản thu sẽ xuất hiện tại đây.
                </div>
              ) : (
                recentEarnings.map((earning) => (
                  <div key={earning.id} className="rounded-xl border border-slate-200/70 bg-white/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{formatVND(earning.netAmount)}</p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{earning.status}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Đơn {earning.orderId.slice(0, 8)} · Phí nền tảng {formatVND(earning.platformFee)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <CardTitle className="text-base">Thông báo payout</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Khi admin duyệt, từ chối hoặc đánh dấu đã chi trả payout, thông báo sẽ xuất hiện trong chuông thông báo và trạng thái trên trang này sẽ cập nhật sau khi làm mới.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={requestPayout}
        title="Gửi yêu cầu rút tiền?"
        message={`Bạn sẽ gửi yêu cầu rút ${formatVND(parsedPayoutAmount)} về tài khoản ${bankAccountMasked}. Trong thời gian chờ xử lý, bạn không thể tạo thêm yêu cầu payout mới.`}
        confirmLabel="Gửi yêu cầu"
        loadingLabel="Đang gửi..."
        loading={requestingPayout}
      />
    </div>
  );
}
