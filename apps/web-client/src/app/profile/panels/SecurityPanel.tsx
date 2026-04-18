'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';

export function SecurityPanel() {
  const { user } = useAppSelector((state) => state.auth);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '' };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;
    const labels = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
    return { score, label: labels[score] };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ kind: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    if (passwordStrength.score < 3) {
      setMessage({
        kind: 'error',
        text: 'Mật khẩu mới chưa đủ mạnh. Cần ít nhất 8 ký tự, có chữ hoa, chữ số và ký tự đặc biệt.',
      });
      return;
    }

    setSubmitting(true);
    // Backend change-password endpoint se duoc phat hanh trong phase tiep theo.
    // Hien tai gia lap de UI van hoan chinh cho nguoi dung trai nghiem.
    setTimeout(() => {
      setSubmitting(false);
      setMessage({
        kind: 'info',
        text: 'Tính năng đổi mật khẩu đang được hoàn thiện (cần endpoint auth-service). UI đã sẵn sàng — liên hệ admin để reset mật khẩu tạm thời.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 700);
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel rounded-[2rem] border-white/60 shadow-xl">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="size-5" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Đổi mật khẩu</CardTitle>
              <CardDescription className="text-sm font-medium">
                Cập nhật mật khẩu định kỳ để bảo vệ tài khoản.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 p-8 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">Mật khẩu hiện tại</label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-12 rounded-xl border-white/80 bg-white/60 px-4 pr-12 text-base font-medium shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Mật khẩu mới</label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  className="h-12 rounded-xl border-white/80 bg-white/60 px-4 pr-12 text-base font-medium shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= passwordStrength.score
                            ? passwordStrength.score <= 1
                              ? 'bg-rose-500'
                              : passwordStrength.score === 2
                                ? 'bg-amber-500'
                                : passwordStrength.score === 3
                                  ? 'bg-lime-500'
                                  : 'bg-emerald-500'
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Độ mạnh: <span className="text-foreground">{passwordStrength.label}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Xác nhận mật khẩu mới</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
                className="h-12 rounded-xl border-white/80 bg-white/60 px-4 text-base font-medium shadow-sm"
              />
            </div>

            {message && (
              <div
                className={`rounded-xl border p-3 text-sm font-semibold flex items-start gap-2 ${
                  message.kind === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : message.kind === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {message.kind === 'success' ? (
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-3 rounded-b-[2rem] border-t border-white/50 bg-white/10 px-8 py-6">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl font-bold"
              onClick={() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setMessage(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl px-8 font-bold shadow-md"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cập nhật mật khẩu
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader className="p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Phiên đăng nhập</CardTitle>
              <CardDescription className="text-sm">
                Email đang đăng nhập: <span className="font-bold">{user?.email}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2 text-sm text-muted-foreground">
          Token JWT được refresh tự động mỗi 15 phút. Nếu bạn nghi ngờ tài khoản bị xâm phạm,
          hãy đăng xuất khỏi tất cả thiết bị và đổi mật khẩu ngay.
        </CardContent>
      </Card>

      <Card className="glass-panel rounded-2xl border-dashed border-2 border-white/60 opacity-80">
        <CardHeader className="p-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center">
              <Smartphone className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Xác thực 2 lớp (2FA)</CardTitle>
              <CardDescription className="text-sm">
                Bảo vệ tài khoản bằng mã OTP từ ứng dụng xác thực. Sắp ra mắt.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
