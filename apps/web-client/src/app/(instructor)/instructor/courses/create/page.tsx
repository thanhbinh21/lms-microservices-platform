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

const formSchema = z.object({
  title: z.string().min(3, { message: "Tiêu đề phải có ít nhất 3 ký tự." }),
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
        router.push(`/instructor/courses/${result.courseId}`);
        return;
      }

      setSubmitError(result.message || 'Không thể tạo khóa học. Vui lòng thử lại.');
    } catch (error) {
      console.error(error);
      setSubmitError('Đã có lỗi hệ thống khi tạo khóa học. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 pt-12">
      <Link href="/instructor/courses" className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại danh sách
      </Link>

      <Card className="rounded-4xl border-white/60 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <CardHeader className="p-8">
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            Khởi tạo khóa học <Sparkles className="w-6 h-6 text-primary" />
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
                className="h-14 rounded-xl bg-white/80 backdrop-blur-sm border-border focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm text-base px-4"
                disabled={isLoading}
                {...form.register('title')}
              />
              {form.formState.errors.title && (
                 <p className="text-sm text-destructive font-bold">{form.formState.errors.title.message}</p>
              )}
              {submitError && <StatusMessage type="error" message={submitError} />}
            </div>
          </form>
        </CardContent>

        <CardFooter className="p-8 bg-black/5 flex justify-end gap-3 mt-4 border-t border-white/40">
           <Button variant="ghost" onClick={() => router.push('/instructor/courses')} className="rounded-xl font-bold" disabled={isLoading}>
             Hủy bỏ
           </Button>
           <Button type="submit" form="create-course-form" className="rounded-xl px-8 shadow-md font-bold h-12 text-base" disabled={isLoading}>
             {isLoading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
             Tiếp tục
           </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
