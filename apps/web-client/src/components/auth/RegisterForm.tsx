'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registerAction } from '@/app/actions/auth';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setUser } from '@/lib/redux/authSlice';
import { Loader2, UserPlus, AlertCircle } from 'lucide-react';
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

// Override schema inline if needed, but assuming standard registerSchema exists
const registerSchema = z.object({
  name: z.string().min(2, 'Tên ít nhất 2 ký tự').max(50, 'Tên quá dài'),
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự'),
  confirmPassword: z.string().min(6, 'Vui lòng xác nhận mật khẩu'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu không khớp nhau",
  path: ["confirmPassword"],
});

type RegisterInput = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await registerAction(data);

      if (result.success && result.user && result.accessToken) {
        dispatch(setUser({
          user: result.user,
          accessToken: result.accessToken,
        }));

        setSuccess('Đăng ký thành công! Đang vào trang chủ...');
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } else {
        setError(result.message || 'Hệ thống đang bận. Đăng ký thất bại.');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
      console.error('Register error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass-panel w-full border-white/60 shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

      <CardHeader className="space-y-2 pb-6 pt-10 px-8 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">Tạo Tài Khoản</CardTitle>
        <CardDescription className="text-base text-muted-foreground font-medium">
          Mở khóa toàn bộ 500+ Khóa học chuyên sâu
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 flex flex-col gap-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-foreground">Họ và Tên</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Nguyễn Văn A"
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Mật khẩu</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••"
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Xác nhận MK</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••"
                        className="h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm transition-all text-sm px-4"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-destructive font-medium" />
                  </FormItem>
                )}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 flex items-start gap-3 animate-in fade-in zoom-in-95 duration-300 mt-2">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-destructive">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3.5 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300 mt-2">
                <p className="text-sm font-bold text-green-700">{success}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5 mt-4" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang khởi tạo...
                </>
              ) : (
                <>
                  Đăng ký miễn phí
                  <UserPlus className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-4 pb-8 pt-0 px-8">
        <div className="relative w-full mt-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white/80 backdrop-blur-sm px-2 text-muted-foreground font-semibold">
              Hoặc
            </span>
          </div>
        </div>
        
        <div className="text-center mt-2">
          <p className="text-sm text-muted-foreground font-medium">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-primary hover:text-primary/80 font-bold hover:underline underline-offset-4">
              Khôi phục quyền truy cập
            </Link>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
