'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/lib/schemas/auth.schema';
import { loginAction } from '@/app/actions/auth';
import { useAppDispatch } from '@/lib/redux/hooks';
import { setUser } from '@/lib/redux/authSlice';
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

export default function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

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
      const result = await loginAction(data);

      if (result.success && result.user && result.accessToken) {
        // Update Redux store
        dispatch(setUser({
          user: result.user,
          accessToken: result.accessToken,
        }));

        setSuccess('Login successful! Redirecting...');
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-white">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-bold text-center text-slate-800">Welcome Back</CardTitle>
        <CardDescription className="text-center text-slate-600">Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent className="px-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm font-medium text-green-600">
                ✓ {success}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center bg-slate-50 border-t pt-6">
        <p className="text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <a href="/register" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
            Register here
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
