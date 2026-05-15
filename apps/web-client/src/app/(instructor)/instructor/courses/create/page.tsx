'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { createCourseAction } from '@/app/actions/instructor';
import { StatusMessage } from '@/components/ui/status-message';
import { toast } from '@/components/ui/toast';

const formSchema = z.object({
  title: z.string().min(3, { message: 'Tiêu đề phải có ít nhất 3 ký tự.' }),
});

export default function CreateCoursePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '' },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setSubmitError('');
    try {
      const result = await createCourseAction(values.title);
      if (result.success && result.courseId) {
        toast('success', 'Tạo khóa học thành công');
        router.push(`/instructor/courses/${result.courseId}?step=1`);
        return;
      }

      const message = result.message || 'Không thể tạo khóa học. Vui lòng thử lại.';
      setSubmitError(message);
      toast('error', 'Tạo khóa học thất bại', message);
    } catch (error) {
      console.error(error);
      setSubmitError('Đã có lỗi hệ thống khi tạo khóa học. Vui lòng thử lại.');
      toast('error', 'Lỗi hệ thống khi tạo khóa học');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="workspace-page-tight pt-8 md:pt-10">
      <Link href="/instructor/courses" className="mb-6 flex w-fit items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách
      </Link>

      <Card className="relative overflow-hidden rounded-4xl border-white/60 bg-white/60 shadow-xl backdrop-blur-xl">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <CardHeader className="p-8">
          <CardTitle className="flex items-center gap-2 text-3xl font-bold">
            Khởi tạo khóa học <Sparkles className="h-6 w-6 text-primary" />
          </CardTitle>
          <CardDescription className="text-base font-medium">
            Hãy bắt đầu bằng cách đặt tên cho khóa học của bạn. Bạn có thể thay đổi nó bất cứ lúc nào.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 pt-0">
          <form id="create-course-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground">Tiêu đề khóa học</label>
              <Input
                placeholder="VD: Nuxt.js Thực chiến Doanh nghiệp..."
                className="h-14 rounded-xl border-border bg-white/80 px-4 text-base shadow-sm backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/40"
                disabled={isLoading}
                {...form.register('title')}
              />
              {form.formState.errors.title && (
                <p className="text-sm font-bold text-destructive">{form.formState.errors.title.message}</p>
              )}
              {submitError && <StatusMessage type="error" message={submitError} />}
            </div>
          </form>
        </CardContent>

        <CardFooter className="mt-4 flex justify-end gap-3 border-t border-white/40 bg-black/5 p-8">
          <Button variant="ghost" onClick={() => router.push('/instructor/courses')} className="rounded-xl font-bold" disabled={isLoading}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="create-course-form" className="h-12 rounded-xl px-8 text-base font-bold shadow-md" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Tiếp tục
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
