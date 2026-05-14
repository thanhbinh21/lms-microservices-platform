'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Bell, CreditCard, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusMessage } from '@/components/ui/status-message';
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

export default function InstructorChannelSettingsPage() {
  const [summary, setSummary] = useState<InstructorEarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<InstructorEarningDto[]>([]);
  const [payouts, setPayouts] = useState<InstructorPayoutDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankAccountMasked, setBankAccountMasked] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');

  async function loadData() {
    setLoading(true);
    const [summaryRes, earningsRes, profileRes, payoutsRes] = await Promise.all([
      getInstructorEarningsSummaryAction(),
      getInstructorEarningsAction(),
      getInstructorPayoutProfileAction(),
      getMyInstructorPayoutsAction(),
    ]);

    if (summaryRes.success && summaryRes.data) {
      setSummary(summaryRes.data);
      setPayoutAmount(summaryRes.data.availableBalance > 0 ? String(Math.round(summaryRes.data.availableBalance)) : '');
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

  const formatVND = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
  const payoutSharePct = earnings[0]?.revenueSharePct ? Math.round(earnings[0].revenueSharePct * 100) : 70;
  const platformSharePct = earnings[0]?.platformFeePct ? Math.round(earnings[0].platformFeePct * 100) : 30;
  const hasPendingPayout = useMemo(() => payouts.some((item) => item.status === 'PENDING'), [payouts]);
  const parsedPayoutAmount = Number(payoutAmount || 0);
  const canRequestPayout = Boolean(
    summary
      && summary.availableBalance > 0
      && parsedPayoutAmount > 0
      && parsedPayoutAmount <= summary.availableBalance
      && bankAccountMasked
      && !hasPendingPayout
      && !requestingPayout,
  );

  async function savePayoutProfile() {
    setStatusMessage(null);
    setSaving(true);
    const result = await saveInstructorPayoutProfileAction({ bankAccount, bankName, accountHolder });
    if (result.success && result.data) {
      setStatusMessage({ type: 'success', message: 'Đã lưu thông tin nhận thanh toán.' });
      setBankAccount('');
      setBankAccountMasked(result.data.bankAccountMasked);
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'Không thể lưu thông tin nhận thanh toán.' });
    }
    setSaving(false);
  }

  async function requestPayout() {
    if (!canRequestPayout) return;
    setStatusMessage(null);
    setRequestingPayout(true);
    const result = await createInstructorPayoutAction(parsedPayoutAmount);
    if (result.success) {
      setStatusMessage({ type: 'success', message: 'Đã tạo yêu cầu rút tiền. Admin sẽ xử lý trong thời gian sớm nhất.' });
      await loadData();
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'Không thể tạo yêu cầu rút tiền.' });
    }
    setRequestingPayout(false);
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kênh và thu nhập</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Quản lý thông tin nhận thanh toán, theo dõi doanh thu và gửi yêu cầu rút tiền.
        </p>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        {statusMessage && <StatusMessage type={statusMessage.type} message={statusMessage.message} />}

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thu nhập của bạn</CardTitle>
            </div>
            <CardDescription className="text-xs">Tổng quan thu nhập từ các khóa học đã bán.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
            ) : summary ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Khả dụng</p>
                  <p className="text-xl font-bold text-emerald-600">{formatVND(summary.availableBalance)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Đã rút</p>
                  <p className="text-xl font-bold">{formatVND(summary.withdrawnBalance)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tổng thu nhập</p>
                  <p className="text-xl font-bold">{formatVND(summary.totalEarned)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Đơn hàng</p>
                  <p className="text-xl font-bold">{summary.totalOrders}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu thu nhập.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Chính sách chia doanh thu</CardTitle>
            <CardDescription className="text-xs">Mỗi đơn hàng thành công được tự động chia theo tỷ lệ hiện tại.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Giảng viên nhận</p>
              <p className="text-lg font-bold text-emerald-700">{payoutSharePct}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Nền tảng giữ phí</p>
              <p className="text-lg font-bold">{platformSharePct}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Nhận thanh toán</CardTitle>
            </div>
            <CardDescription className="text-xs">Lưu tài khoản ngân hàng để admin xử lý yêu cầu rút tiền.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bankAccountMasked && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Tài khoản đang lưu: {bankName} - {bankAccountMasked} - {accountHolder}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="bank-account" className="text-xs font-bold text-muted-foreground">Số tài khoản</label>
                <Input id="bank-account" placeholder="VD: 1234567890" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label htmlFor="bank-name" className="text-xs font-bold text-muted-foreground">Tên ngân hàng</label>
                <Input id="bank-name" placeholder="VD: Vietcombank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="account-holder" className="text-xs font-bold text-muted-foreground">Tên chủ tài khoản</label>
                <Input id="account-holder" placeholder="VD: NGUYEN VAN A" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <Button
              type="button"
              className="rounded-xl font-bold"
              onClick={savePayoutProfile}
              disabled={!bankAccount || !bankName || !accountHolder || saving}
            >
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Rút tiền</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Mỗi giảng viên chỉ có một yêu cầu rút tiền đang chờ xử lý tại một thời điểm.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                type="number"
                min={0}
                max={summary?.availableBalance ?? 0}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Nhập số tiền muốn rút"
                className="rounded-xl"
              />
              <Button type="button" className="rounded-xl font-bold" disabled={!canRequestPayout} onClick={requestPayout}>
                {requestingPayout ? 'Đang gửi...' : 'Gửi yêu cầu rút'}
              </Button>
            </div>
            {hasPendingPayout && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Bạn đang có một yêu cầu rút tiền chờ xử lý. Hãy đợi admin duyệt trước khi tạo yêu cầu mới.
              </p>
            )}
            {!bankAccountMasked && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Vui lòng lưu thông tin nhận thanh toán trước khi gửi yêu cầu rút tiền.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Lịch sử rút tiền</CardTitle>
            </div>
            <CardDescription className="text-xs">Theo dõi trạng thái các yêu cầu rút tiền đã gửi.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có yêu cầu rút tiền nào.</p>
            ) : (
              <div className="space-y-3">
                {payouts.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{formatVND(item.amount)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.bankAccountMasked} - {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                      {item.adminNote && <p className="mt-1 text-[11px] text-rose-600">Ghi chú admin: {item.adminNote}</p>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PAYOUT_STATUS_CLASS[item.status]}`}>
                      {PAYOUT_STATUS_LABEL[item.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thông báo</CardTitle>
            </div>
            <CardDescription className="text-xs">Thông báo về đăng ký mới, hỏi đáp và thanh toán sẽ hiển thị qua chuông thông báo.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
