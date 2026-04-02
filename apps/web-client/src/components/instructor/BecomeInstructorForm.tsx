'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, GraduationCap, Loader2, Send, UserRound } from 'lucide-react';
import { createInstructorRequestAction, getMyPendingInstructorRequestAction } from '@/app/actions/instructor';
import type { InstructorRequestDto } from '@/app/actions/instructor';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';

const inputClass =
  'h-12 rounded-xl bg-white/60 backdrop-blur-sm border-white/80 focus-visible:ring-primary/40 focus-visible:border-primary shadow-sm transition-all text-sm px-4';

const textareaClass =
  'min-h-28 w-full rounded-xl border border-white/80 bg-white/60 px-4 py-3 text-sm shadow-sm backdrop-blur-sm outline-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40';

const formSchema = z.object({
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ'),
  expertise: z.string().min(2, 'Vui lòng nhập chuyên môn'),
  experienceYears: z.coerce.number().min(0, 'Kinh nghiệm không hợp lệ'),
  bio: z.string().min(20, 'Mô tả tối thiểu 20 ký tự'),
  courseTitle: z.string().min(2, 'Vui lòng nhập tên khóa học'),
  courseCategory: z.string().min(2, 'Vui lòng nhập danh mục'),
  courseDescription: z.string().min(20, 'Mô tả khóa học tối thiểu 20 ký tự'),
});

type FormValues = z.infer<typeof formSchema>;

function SectionLabel({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex gap-3 border-b border-white/50 pb-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function BecomeInstructorForm() {
  const router = useRouter();
  const [checkingPending, setCheckingPending] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<InstructorRequestDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMyPendingInstructorRequestAction();
      if (!cancelled && res.success && res.request) {
        setPendingRequest(res.request);
      }
      if (!cancelled) setCheckingPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      expertise: '',
      experienceYears: 0,
      bio: '',
      courseTitle: '',
      courseCategory: '',
      courseDescription: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError('');

    const result = await createInstructorRequestAction(values);

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    form.reset();
    setIsSubmitting(false);
    router.replace('/?instructorSubmitted=1');
  };

  if (checkingPending) {
    return (
      <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
        <CardContent className="flex min-h-[200px] items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Đang kiểm tra trạng thái hồ sơ...</p>
        </CardContent>
      </Card>
    );
  }

  if (pendingRequest) {
    return (
      <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
        <CardHeader className="relative space-y-2 px-6 pb-2 pt-8 text-center sm:px-10 sm:text-left">
          <CardTitle className="text-2xl font-bold tracking-tight md:text-3xl">Hồ sơ đang chờ duyệt</CardTitle>
          <CardDescription className="text-base font-medium text-muted-foreground">
            Bạn đã gửi đăng ký làm giảng viên vào{' '}
            {new Date(pendingRequest.createdAt).toLocaleString('vi-VN')}. Vui lòng đợi ban quản trị xem xét — bạn chỉ có thể
            gửi hồ sơ mới sau khi có kết quả (duyệt hoặc từ chối).
          </CardDescription>
        </CardHeader>
        <CardContent className="relative px-6 pb-8 sm:px-10">
          <StatusMessage
            type="success"
            message="Đơn của bạn đang ở trạng thái chờ xem xét. Chúng tôi sẽ liên hệ qua email hoặc số điện thoại đã đăng ký khi có cập nhật."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="relative space-y-2 px-6 pb-2 pt-8 text-center sm:px-10 sm:text-left">
        <CardTitle className="text-2xl font-bold tracking-tight md:text-3xl">Hồ sơ đăng ký giảng viên</CardTitle>
        <CardDescription className="text-base font-medium text-muted-foreground">
          Thông tin được dùng để xét duyệt. Vui lòng điền trung thực và đầy đủ.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative px-6 pb-2 sm:px-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
            <div className="space-y-5">
              <SectionLabel
                icon={UserRound}
                title="Thông tin cá nhân"
                description="Họ tên và cách liên hệ khi cần trao đổi hồ sơ."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Họ và tên</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSubmitting} placeholder="Nguyễn Văn A" className={inputClass} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Số điện thoại</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSubmitting} placeholder="09xxxxxxxx" className={inputClass} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-5">
              <SectionLabel
                icon={GraduationCap}
                title="Kinh nghiệm & giới thiệu"
                description="Giúp ban xét duyệt hiểu rõ nền tảng chuyên môn của bạn."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expertise"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Chuyên môn chính</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSubmitting} placeholder="VD: React, Data Science..." className={inputClass} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="experienceYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Số năm kinh nghiệm</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} disabled={isSubmitting} className={inputClass} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Giới thiệu bản thân</FormLabel>
                    <FormControl>
                      <textarea {...field} disabled={isSubmitting} placeholder="Kinh nghiệm làm việc, chứng chỉ, định hướng giảng dạy..." className={textareaClass} />
                    </FormControl>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-5">
              <SectionLabel
                icon={BookOpen}
                title="Khóa học dự kiến"
                description="Ý tưởng khóa đầu tiên bạn muốn triển khai trên NexEdu."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="courseTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Tên khóa học</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSubmitting} placeholder="VD: Next.js toàn tập" className={inputClass} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="courseCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">Danh mục</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSubmitting} placeholder="VD: Lập trình web" className={inputClass} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="courseDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">Mô tả khóa học</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        disabled={isSubmitting}
                        placeholder="Đối tượng học viên, nội dung chính, kết quả đạt được..."
                        className={textareaClass}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />
            </div>

            {error && <StatusMessage type="error" message={error} />}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30 md:max-w-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang gửi hồ sơ...
                </>
              ) : (
                <>
                  Gửi hồ sơ xét duyệt
                  <Send className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-white/40 bg-white/30 px-6 py-5 text-center sm:px-10 sm:text-left">
        <p className="text-xs font-medium leading-relaxed text-muted-foreground">
          Bằng việc gửi hồ sơ, bạn xác nhận thông tin là chính xác. Chúng tôi có thể liên hệ qua email hoặc số điện thoại đã
          cung cấp.
        </p>
      </CardFooter>
    </Card>
  );
}
