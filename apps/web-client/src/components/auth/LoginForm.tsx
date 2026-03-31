'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginAction } from '@/app/actions/auth';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setUser } from '@/lib/redux/authSlice';
import { Loader2, QrCode, LogIn } from 'lucide-react';
import Link from 'next/link';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { mapUiErrorMessage, mapUiSuccessMessage } from '@/lib/ui-notification';
import { StatusMessage } from '@/components/ui/status-message';

// Override schema inline if needed, but assuming standard loginSchema format exists
const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự'),
});
type LoginInput = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // States: Default, Loading, Error (validation via React Hook Form), Error (API via error state), Disabled
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Trigger API
      const result = await loginAction(data);

      if (result.success && result.user && result.accessToken) {
        // 2. Map Redux
        dispatch(setUser({
          user: result.user,
          accessToken: result.accessToken,
        }));

        setSuccess(mapUiSuccessMessage(result.message, 'Đăng nhập thành công! Đang chuyển hướng...'));
        const redirectPath = result.user.role === 'INSTRUCTOR' ? '/instructor/courses' : '/dashboard';
        
        // Dieu huong theo vai tro de giang vien vao thang khu vuc quan ly khoa hoc.
        setTimeout(() => {
          router.push(redirectPath);
        }, 800);
      } else {
        // API Error logic
        setError(mapUiErrorMessage(result.message, 'Tài khoản hoặc mật khẩu không chính xác.'));
      }
    } catch (err) {
      setError(mapUiErrorMessage(err, 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.'));
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass-panel w-full border-white/60 shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden relative">
      {/* Decorative inner glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

      <CardHeader className="space-y-2 pb-6 pt-10 px-8 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">Đăng Nhập</CardTitle>
        <CardDescription className="text-base text-muted-foreground font-medium">
          Truy cập nền tảng học tập thế hệ mới
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 flex flex-col gap-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-foreground">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="nhapemail@domain.com"
                      className="h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm transition-all text-sm px-4"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-destructive font-medium" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="font-semibold text-foreground">Mật khẩu</FormLabel>
                    <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline hover:text-primary/80">
                      Quên mật khẩu?
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Nhập mật khẩu của bạn"
                      className="h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm transition-all text-sm px-4"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-destructive font-medium" />
                </FormItem>
              )}
            />

            {/* Remember & QR Code */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  disabled={isLoading}
                  className="w-4 h-4 rounded appearance-none border-2 border-primary/30 checked:bg-primary checked:border-primary transition-all relative
                    checked:after:content-[''] checked:after:absolute checked:after:w-1.5 checked:after:h-2.5 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white 
                    checked:after:left-[5px] checked:after:top-[1px] checked:after:rotate-45 disabled:opacity-50"
                  defaultChecked
                />
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>

              <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-sm font-semibold text-primary hover:text-primary/80 hover:bg-transparent" disabled={isLoading}>
                <QrCode className="w-4 h-4 mr-1.5" />
                Quét mã QR
              </Button>
            </div>

            {/* Error State: API Failed */}
            {error && <StatusMessage type="error" message={error} />}

            {/* Success State */}
            {success && <StatusMessage type="success" message={success} />}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5 mt-2" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  Đăng nhập
                  <LogIn className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-4 pb-8 pt-2 px-8">
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white/80 backdrop-blur-sm px-2 text-muted-foreground font-semibold">
              Hoặc tiếp tục với
            </span>
          </div>
        </div>
        
        <div className="text-center mt-2">
          <p className="text-sm text-muted-foreground font-medium">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-primary hover:text-primary/80 font-bold hover:underline underline-offset-4">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
