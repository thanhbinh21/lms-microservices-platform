'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Bell, CreditCard, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusMessage } from '@/components/ui/status-message';
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
  PENDING: 'Chá» xá»­ lÃ½',
  APPROVED: 'ÄÃ£ duyá»‡t',
  REJECTED: 'Tá»« chá»‘i',
  PAID: 'ÄÃ£ chi tráº£',
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

  const formatVND = (value: number) => `${value.toLocaleString('vi-VN')} Ä‘`;
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
      setStatusMessage({ type: 'success', message: 'ÄÃ£ lÆ°u thÃ´ng tin nháº­n thanh toÃ¡n.' });
      toast('success', 'Đã lưu thông tin nhận thanh toán');
      setBankAccount('');
      setBankAccountMasked(result.data.bankAccountMasked);
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'KhÃ´ng thá»ƒ lÆ°u thÃ´ng tin nháº­n thanh toÃ¡n.' });
      toast('error', 'Lưu thông tin thất bại', result.message || 'Vui lòng thử lại.');
    }
    setSaving(false);
  }

  async function requestPayout() {
    if (!canRequestPayout) return;
    setStatusMessage(null);
    setRequestingPayout(true);
    const result = await createInstructorPayoutAction(parsedPayoutAmount);
    if (result.success) {
      setStatusMessage({ type: 'success', message: 'ÄÃ£ táº¡o yÃªu cáº§u rÃºt tiá»n. Admin sáº½ xá»­ lÃ½ trong thá»i gian sá»›m nháº¥t.' });
      toast('success', 'Đã tạo yêu cầu rút tiền');
      await loadData();
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'KhÃ´ng thá»ƒ táº¡o yÃªu cáº§u rÃºt tiá»n.' });
      toast('error', 'Tạo yêu cầu rút tiền thất bại', result.message || 'Vui lòng thử lại.');
    }
    setRequestingPayout(false);
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="workspace-page-title">KÃªnh vÃ  thu nháº­p</h1>
        <p className="workspace-page-description">
          Quáº£n lÃ½ thÃ´ng tin nháº­n thanh toÃ¡n, theo dÃµi doanh thu vÃ  gá»­i yÃªu cáº§u rÃºt tiá»n.
        </p>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        {statusMessage && <StatusMessage type={statusMessage.type} message={statusMessage.message} />}

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thu nháº­p cá»§a báº¡n</CardTitle>
            </div>
            <CardDescription className="text-xs">Tá»•ng quan thu nháº­p tá»« cÃ¡c khÃ³a há»c Ä‘Ã£ bÃ¡n.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Äang táº£i dá»¯ liá»‡u...</p>
            ) : summary ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Kháº£ dá»¥ng</p>
                  <p className="text-xl font-bold text-emerald-600">{formatVND(summary.availableBalance)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">ÄÃ£ rÃºt</p>
                  <p className="text-xl font-bold">{formatVND(summary.withdrawnBalance)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tá»•ng thu nháº­p</p>
                  <p className="text-xl font-bold">{formatVND(summary.totalEarned)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">ÄÆ¡n hÃ ng</p>
                  <p className="text-xl font-bold">{summary.totalOrders}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">ChÆ°a cÃ³ dá»¯ liá»‡u thu nháº­p.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold">ChÃ­nh sÃ¡ch chia doanh thu</CardTitle>
            <CardDescription className="text-xs">Má»—i Ä‘Æ¡n hÃ ng thÃ nh cÃ´ng Ä‘Æ°á»£c tá»± Ä‘á»™ng chia theo tá»· lá»‡ hiá»‡n táº¡i.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Giáº£ng viÃªn nháº­n</p>
              <p className="text-lg font-bold text-emerald-700">{payoutSharePct}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Ná»n táº£ng giá»¯ phÃ­</p>
              <p className="text-lg font-bold">{platformSharePct}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Nháº­n thanh toÃ¡n</CardTitle>
            </div>
            <CardDescription className="text-xs">LÆ°u tÃ i khoáº£n ngÃ¢n hÃ ng Ä‘á»ƒ admin xá»­ lÃ½ yÃªu cáº§u rÃºt tiá»n.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bankAccountMasked && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                TÃ i khoáº£n Ä‘ang lÆ°u: {bankName} - {bankAccountMasked} - {accountHolder}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="bank-account" className="text-xs font-bold text-muted-foreground">Sá»‘ tÃ i khoáº£n</label>
                <Input id="bank-account" placeholder="VD: 1234567890" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label htmlFor="bank-name" className="text-xs font-bold text-muted-foreground">TÃªn ngÃ¢n hÃ ng</label>
                <Input id="bank-name" placeholder="VD: Vietcombank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="account-holder" className="text-xs font-bold text-muted-foreground">TÃªn chá»§ tÃ i khoáº£n</label>
                <Input id="account-holder" placeholder="VD: NGUYEN VAN A" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <Button
              type="button"
              className="rounded-xl font-bold"
              onClick={savePayoutProfile}
              disabled={!bankAccount || !bankName || !accountHolder || saving}
            >
              {saving ? 'Äang lÆ°u...' : 'LÆ°u thÃ´ng tin'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">RÃºt tiá»n</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Má»—i giáº£ng viÃªn chá»‰ cÃ³ má»™t yÃªu cáº§u rÃºt tiá»n Ä‘ang chá» xá»­ lÃ½ táº¡i má»™t thá»i Ä‘iá»ƒm.
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
                placeholder="Nháº­p sá»‘ tiá»n muá»‘n rÃºt"
                className="rounded-xl"
              />
              <Button type="button" className="rounded-xl font-bold" disabled={!canRequestPayout} onClick={requestPayout}>
                {requestingPayout ? 'Äang gá»­i...' : 'Gá»­i yÃªu cáº§u rÃºt'}
              </Button>
            </div>
            {hasPendingPayout && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Báº¡n Ä‘ang cÃ³ má»™t yÃªu cáº§u rÃºt tiá»n chá» xá»­ lÃ½. HÃ£y Ä‘á»£i admin duyá»‡t trÆ°á»›c khi táº¡o yÃªu cáº§u má»›i.
              </p>
            )}
            {!bankAccountMasked && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Vui lÃ²ng lÆ°u thÃ´ng tin nháº­n thanh toÃ¡n trÆ°á»›c khi gá»­i yÃªu cáº§u rÃºt tiá»n.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Lá»‹ch sá»­ rÃºt tiá»n</CardTitle>
            </div>
            <CardDescription className="text-xs">Theo dÃµi tráº¡ng thÃ¡i cÃ¡c yÃªu cáº§u rÃºt tiá»n Ä‘Ã£ gá»­i.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Äang táº£i...</p>
            ) : payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">ChÆ°a cÃ³ yÃªu cáº§u rÃºt tiá»n nÃ o.</p>
            ) : (
              <div className="space-y-3">
                {payouts.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{formatVND(item.amount)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.bankAccountMasked} - {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                      {item.adminNote && <p className="mt-1 text-[11px] text-rose-600">Ghi chÃº admin: {item.adminNote}</p>}
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
              <CardTitle className="text-sm font-bold">ThÃ´ng bÃ¡o</CardTitle>
            </div>
            <CardDescription className="text-xs">ThÃ´ng bÃ¡o vá» Ä‘Äƒng kÃ½ má»›i, há»i Ä‘Ã¡p vÃ  thanh toÃ¡n sáº½ hiá»ƒn thá»‹ qua chuÃ´ng thÃ´ng bÃ¡o.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}


