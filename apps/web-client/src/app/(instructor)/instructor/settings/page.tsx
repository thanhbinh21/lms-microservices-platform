'use client';

import { useEffect, useState } from 'react';
import { Bell, CreditCard, UserCircle, Sparkles, Wallet, ArrowDownToLine } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  getInstructorEarningsSummaryAction,
  getInstructorEarningsAction,
  type InstructorEarningDto,
  type InstructorEarningsSummary,
} from '@/app/actions/instructor';

export default function InstructorChannelSettingsPage() {
  const [summary, setSummary] = useState<InstructorEarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<InstructorEarningDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    async function load() {
      const [summaryRes, earningsRes] = await Promise.all([
        getInstructorEarningsSummaryAction(),
        getInstructorEarningsAction(),
      ]);
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (earningsRes.success && earningsRes.data) setEarnings(earningsRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' đ';

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kênh &amp; Thu nhập</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Quản lý thông tin kênh và theo dõi thu nhập từ khóa học.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Earnings overview */}
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
              <p className="text-sm text-muted-foreground">Đang tải...</p>
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

        {/* Bank withdrawal setup */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Nhận thanh toán</CardTitle>
            </div>
            <CardDescription className="text-xs">Liên kết tài khoản ngân hàng để nhận tiền rút.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Số tài khoản</label>
                <Input
                  placeholder="VD: 1234567890"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Tên ngân hàng</label>
                <Input
                  placeholder="VD: Vietcombank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-muted-foreground">Tên chủ tài khoản</label>
                <Input
                  placeholder="VD: NGUYEN VAN A"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            {bankAccount && bankName && accountHolder && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Thông tin tài khoản sẽ được lưu an toàn. Rút tiền sẽ được xử lý trong 1-3 ngày làm việc.
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" className="rounded-xl font-bold" disabled>
                <ArrowDownToLine className="mr-2 size-4" />
                Rút tiền
              </Button>
              <span className="text-xs text-muted-foreground">Tính năng rút tiền sắp ra mắt</span>
            </div>
          </CardContent>
        </Card>

        {/* Transaction history */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Lịch sử giao dịch</CardTitle>
            </div>
            <CardDescription className="text-xs">Các khoản thanh toán đã nhận được.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            ) : earnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
            ) : (
              <div className="space-y-3">
                {earnings.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{formatVND(e.netAmount)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.courseId.slice(0, 8)}... · {new Date(e.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                        e.status === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : e.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {e.status === 'AVAILABLE' ? 'Khả dụng' : e.status === 'PENDING' ? 'Chờ' : e.status}
                      </span>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Phí: {formatVND(e.platformFee)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel info */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thông tin kênh</CardTitle>
            </div>
            <CardDescription className="text-xs">Tên hiển thị và mô tả ngắn trên trang công khai.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Tên kênh</label>
              <Input placeholder="VD: NexEdu — Lập trình Web" className="rounded-xl" disabled />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Giới thiệu kênh</label>
              <textarea className="min-h-20 w-full rounded-xl border border-input bg-white p-3 text-sm" placeholder="Mô tả ngắn về nội dung bạn giảng dạy..." disabled />
            </div>
            <p className="text-xs text-muted-foreground">Chỉnh sửa thông tin kênh sẽ sớm được hỗ trợ.</p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold">Thông báo</CardTitle>
            </div>
            <CardDescription className="text-xs">Email khi có đăng ký mới hoặc bình luận.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Chưa có tùy chọn — giao diện giữ chỗ.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
