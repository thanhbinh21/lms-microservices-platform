'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import { toast } from '@/components/ui/toast';
import { createCourseAction } from '@/app/actions/instructor';

const formSchema = z.object({
  title: z.string().trim().min(3, { message: 'Tiêu đề phải có ít nhất 3 ký tự.' }).max(120, { message: 'Tiêu đề tối đa 120 ký tự.' }),
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Đã có lỗi hệ thống khi tạo khóa học. Vui lòng thử lại.';
}

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
      const result = await createCourseAction(values.title.trim());
      if (result.success && result.courseId) {
        toast('success', 'Đã tạo bản nháp khóa học');
        router.push(`/instructor/courses/${result.courseId}?step=1`);
        return;
      }

      const message = result.message || 'Không thể tạo khóa học. Vui lòng thử lại.';
      setSubmitError(message);
      toast('error', 'Tạo khóa học thất bại', message);
    } catch (error) {
      const message = getErrorMessage(error);
      setSubmitError(message);
      toast('error', 'Tạo khóa học thất bại', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="workspace-page-tight pt-8 md:pt-10">
      <Link href="/instructor/courses" className="mb-6 flex w-fit items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="mr-2 size-4" /> Quay lại danh sách
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="rounded-2xl border-white/60 bg-white/60 shadow-xl backdrop-blur-xl">
          <CardHeader className="p-8">
            <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <BookOpen className="size-3.5" />
              Bước 1
            </div>
            <CardTitle className="text-3xl font-bold">Tạo bản nháp khóa học</CardTitle>
            <CardDescription className="text-base font-medium">
              Đặt tên khóa học trước, sau đó hệ thống sẽ đưa bạn vào wizard để bổ sung danh mục, level, giá, thumbnail, chapter, lesson và nội dung.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8 pt-0">
            <form id="create-course-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Tiêu đề khóa học <span className="text-destructive">*</span></label>
                <Input
                  placeholder="VD: Lập trình Node.js thực chiến"
                  className="h-12 rounded-xl border-border bg-white/80 px-4 text-base shadow-sm backdrop-blur-sm focus-visible:border-primary focus-visible:ring-primary/40"
                  disabled={isLoading}
                  {...form.register('title')}
                />
                {form.formState.errors.title && <p className="text-sm font-bold text-destructive">{form.formState.errors.title.message}</p>}
                {submitError && <StatusMessage type="error" message={submitError} />}
              </div>
            </form>
          </CardContent>

          <CardFooter className="mt-4 flex justify-end gap-3 border-t border-white/40 bg-black/5 p-8">
            <Button variant="ghost" onClick={() => router.push('/instructor/courses')} className="rounded-xl font-bold" disabled={isLoading}>
              Hủy bỏ
            </Button>
            <Button type="submit" form="create-course-form" className="h-12 rounded-xl px-8 text-base font-bold shadow-md" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 size-5 animate-spin" />}
              Tiếp tục vào wizard
            </Button>
          </CardFooter>
        </Card>

        <Card className="h-fit rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">Flow sau khi tạo</CardTitle>
            <CardDescription className="text-xs">Các bước tiếp theo nằm trong course wizard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Thông tin cơ bản, danh mục, level và giá.',
              'Upload thumbnail để khóa học dễ nhận diện.',
              'Tạo chapter, lesson và thêm video/text content.',
              'Preview toàn bộ khóa học trước khi publish.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
