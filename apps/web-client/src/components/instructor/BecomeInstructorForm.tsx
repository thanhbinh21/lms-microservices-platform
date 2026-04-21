'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { becomeEducatorAction } from '@/app/actions/auth';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setUser } from '@/lib/redux/authSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';

export default function BecomeInstructorForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onBecomeEducator = async () => {
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const result = await becomeEducatorAction();

    if (result.success && result.user && result.accessToken) {
      dispatch(
        setUser({
          user: result.user,
          accessToken: result.accessToken,
        }),
      );

      setSuccess(result.message || 'Nâng cấp tài khoản thành công. Đang chuyển sang Studio...');
      setTimeout(() => {
        router.replace('/instructor');
      }, 700);
    } else {
      setError(result.message || 'Không thể nâng cấp tài khoản ở thời điểm này.');
    }

    setIsSubmitting(false);
  };

  return (
    <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="relative space-y-3 px-6 pb-2 pt-8 text-center sm:px-10 sm:text-left">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Sparkles className="size-6 text-primary" />
          Nâng cấp lên Giảng viên
        </CardTitle>
        <CardDescription className="text-base font-medium text-muted-foreground">
          Hệ thống sẽ nâng quyền trực tiếp từ STUDENT lên INSTRUCTOR cho chính tài khoản đang đăng nhập.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative space-y-5 px-6 pb-2 sm:px-10">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <p className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Điều kiện áp dụng
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              Chỉ tài khoản STUDENT mới có thể tự nâng quyền.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              Phiên đăng nhập sẽ được cập nhật token mới với role INSTRUCTOR.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              Sau khi thành công, bạn sẽ được chuyển ngay đến Studio giảng viên.
            </li>
          </ul>
        </div>

        {error && <StatusMessage type="error" message={error} />}
        {success && <StatusMessage type="success" message={success} />}

        <Button
          type="button"
          onClick={onBecomeEducator}
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30 md:max-w-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Đang nâng cấp...
            </>
          ) : (
            'Nâng cấp thành giảng viên'
          )}
        </Button>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-white/40 bg-white/30 px-6 py-5 text-center sm:px-10 sm:text-left">
        <p className="text-xs font-medium leading-relaxed text-muted-foreground">
          Nếu bạn đang đăng nhập bằng tab khác, vui lòng tải lại tab đó sau khi nâng cấp để đồng bộ trạng thái quyền mới.
        </p>
      </CardFooter>
    </Card>
  );
}
