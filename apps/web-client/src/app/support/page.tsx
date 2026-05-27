'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, HelpCircle, Mail, MessageSquare, Send, ShieldQuestion } from 'lucide-react';
import { createSupportTicketAction } from '@/app/actions/support';
import { PublicPageHeader, PublicPageShell } from '@/components/shared/public-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useAppSelector } from '@/lib/redux/hooks';

const faqs = [
  {
    icon: BookOpen,
    question: 'Làm sao để đăng ký khóa học?',
    answer: 'Đăng nhập, mở trang chi tiết khóa học và chọn đăng ký hoặc thanh toán. Khóa miễn phí có thể bắt đầu học ngay.',
  },
  {
    icon: MessageSquare,
    question: 'Tôi đặt câu hỏi cho giảng viên ở đâu?',
    answer: 'Trong màn hình học, mở mục Hỏi đáp của bài học hoặc vào Dashboard > Hỏi đáp để theo dõi phản hồi.',
  },
  {
    icon: Mail,
    question: 'Không nhận được email thông báo thì xử lý thế nào?',
    answer: 'Kiểm tra hộp thư spam trước. Nếu vẫn không có, gửi ticket hỗ trợ với email tài khoản để đội ngũ kiểm tra.',
  },
  {
    icon: ShieldQuestion,
    question: 'Làm sao để trở thành giảng viên?',
    answer: 'Gửi hồ sơ tại trang Trở thành giảng viên. Admin sẽ xét duyệt và phản hồi trong 1-3 ngày làm việc.',
  },
];

export default function SupportPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [form, setForm] = useState({ subject: '', message: '' });
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError('');

    if (!isAuthenticated) {
      toast('info', 'Cần đăng nhập', 'Vui lòng đăng nhập để gửi và theo dõi ticket hỗ trợ.');
      return;
    }
    if (form.subject.trim().length < 8) {
      setFieldError('Chủ đề cần có ít nhất 8 ký tự.');
      return;
    }
    if (form.message.trim().length < 20) {
      setFieldError('Nội dung cần mô tả rõ hơn, tối thiểu 20 ký tự.');
      return;
    }

    setSubmitting(true);
    const result = await createSupportTicketAction({
      subject: form.subject.trim(),
      description: form.message.trim(),
      category: 'OTHER',
      priority: 'NORMAL',
    });
    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      setForm({ subject: '', message: '' });
      toast('success', 'Đã gửi yêu cầu', 'Đội ngũ hỗ trợ sẽ phản hồi trong dashboard của bạn.');
      return;
    }

    toast('error', 'Không gửi được yêu cầu', result.message || 'Vui lòng thử lại sau.');
  };

  return (
    <PublicPageShell mainClassName="max-w-5xl space-y-10 py-10">
      <PublicPageHeader
        centered
        eyebrow="Hỗ trợ"
        title={<><span className="text-primary">Trung tâm</span> trợ giúp NexEdu</>}
        description="Tìm câu trả lời nhanh hoặc gửi ticket để đội ngũ hỗ trợ xử lý theo tài khoản của bạn."
      />

      <section className="grid gap-4 md:grid-cols-2">
        {faqs.map((faq) => (
          <Card key={faq.question} className="glass-panel rounded-2xl border-white/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start gap-3 text-base font-bold">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <faq.icon className="size-5" />
                </span>
                {faq.question}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium leading-relaxed text-muted-foreground">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="glass-panel rounded-2xl border-white/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <HelpCircle className="size-5 text-primary" />
            Gửi ticket hỗ trợ
          </CardTitle>
          <p className="text-sm font-medium text-muted-foreground">
            Ticket cá nhân yêu cầu đăng nhập để bảo vệ dữ liệu và giúp bạn theo dõi phản hồi tại Dashboard.
          </p>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Send className="size-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Ticket đã được ghi nhận</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Bạn có thể theo dõi trạng thái tại Dashboard hỗ trợ.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild className="rounded-xl font-semibold">
                  <Link href="/dashboard/support">Xem ticket của tôi</Link>
                </Button>
                <Button variant="outline" className="rounded-xl bg-white/70 font-semibold" onClick={() => setSubmitted(false)}>
                  Gửi ticket khác
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-semibold">Chủ đề</label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Ví dụ: Không truy cập được bài học đã mua"
                  className="h-11 rounded-xl bg-white/70"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-semibold">Nội dung</label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  placeholder="Mô tả vấn đề, khóa học liên quan và thao tác bạn đã thử..."
                  rows={6}
                  className="resize-none rounded-xl bg-white/70"
                  disabled={submitting}
                />
              </div>
              {fieldError ? <p className="text-sm font-semibold text-red-600">{fieldError}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" disabled={submitting || !isAuthenticated} className="gap-2 rounded-xl font-semibold">
                  {submitting ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="size-4" />}
                  Gửi yêu cầu
                </Button>
                {!isAuthenticated ? (
                  <p className="text-sm font-medium text-muted-foreground">
                    Bạn cần <Link href="/login" className="font-bold text-primary hover:underline">đăng nhập</Link> trước khi gửi ticket.
                  </p>
                ) : null}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3 text-center text-sm font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-2"><Mail className="size-4" /> support@nexedu.com</span>
        <span className="inline-flex items-center gap-2"><Clock className="size-4" /> Phản hồi trong 24 giờ làm việc, thứ 2 đến thứ 6</span>
      </div>
    </PublicPageShell>
  );
}
