'use client';

import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { Mail, MessageSquare, Phone, Clock, BookOpen, HelpCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useAppSelector } from '@/lib/redux/hooks';
import { createSupportTicketAction } from '@/app/actions/support';
import { toast } from '@/components/ui/toast';

export default function SupportPage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast('info', 'Cần đăng nhập', 'Vui lòng đăng nhập để gửi ticket hỗ trợ cá nhân.');
      return;
    }
    setSubmitting(true);
    const res = await createSupportTicketAction({
      subject: form.subject.trim(),
      description: form.message.trim(),
      category: 'OTHER',
      priority: 'NORMAL',
    });
    setSubmitting(false);
    if (res.success) {
      setSubmitted(true);
      toast('success', 'Đã gửi yêu cầu', 'Đội ngũ hỗ trợ sẽ phản hồi bạn sớm nhất.');
      return;
    }
    toast('error', 'Gửi yêu cầu thất bại', res.message || 'Vui lòng thử lại sau.');
  };

  return (
    <div className="glass-page min-h-screen text-foreground">
      <SharedNavbar />

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-16 md:px-8 md:py-24">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
              <HelpCircle className="size-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Trung tâm Hỗ trợ <span className="text-primary">NexEdu</span>
            </h1>
            <p className="text-base text-muted-foreground md:text-lg max-w-2xl mx-auto">
              Chúng tôi luôn sẵn sàng hỗ trợ bạn. Tìm câu trả lời nhanh chóng hoặc gửi yêu cầu hỗ trợ.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 pb-16 md:px-8">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <BookOpen className="size-5 text-primary" />
                    Làm sao để đăng ký khóa học?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sau khi đăng nhập, vào trang khóa học và chọn khóa bạn quan tâm. Nhấn "Đăng ký" để hoàn tất thanh toán hoặc chọn khóa miễn phí để bắt đầu học ngay.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <MessageSquare className="size-5 text-primary" />
                    Làm sao để đặt câu hỏi trong khóa học?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Mở bài học bạn đang học, cuộn xuống phần "Hỏi đáp" để đặt câu hỏi. Giảng viên sẽ phản hồi trong thời gian sớm nhất.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Mail className="size-5 text-primary" />
                    Tôi không nhận được email xác nhận?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Vui lòng kiểm tra hộp thư spam hoặc thư rác. Nếu vẫn không nhận được, liên hệ hỗ trợ qua form bên dưới.
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Phone className="size-5 text-primary" />
                    Làm sao để trở thành giảng viên?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Gửi hồ sơ ứng tuyển tại trang "Trở thành Giảng viên". Admin sẽ xem xét và phản hồi trong 1-3 ngày làm việc.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card className="glass-panel overflow-hidden">
              <CardHeader className="px-6 pt-8 pb-2">
                <CardTitle className="text-xl font-bold">Gửi yêu cầu hỗ trợ</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Điền thông tin bên dưới, chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.
                </p>
              </CardHeader>
              <CardContent className="px-6 pb-8">
                {submitted ? (
                  <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                      <Send className="size-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-700">Đã gửi yêu cầu!</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Chúng tôi đã nhận được yêu cầu của bạn và sẽ phản hồi trong thời gian sớm nhất.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setSubmitted(false)}>
                      Gửi yêu cầu khác
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold" htmlFor="name">Họ và tên</label>
                        <Input
                          id="name"
                          placeholder="Nguyễn Văn A"
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold" htmlFor="email">Email</label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@example.com"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold" htmlFor="subject">Chủ đề</label>
                      <Input
                        id="subject"
                        placeholder="Vấn đề bạn cần hỗ trợ"
                        value={form.subject}
                        onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold" htmlFor="message">Nội dung</label>
                      <Textarea
                        id="message"
                        placeholder="Mô tả chi tiết vấn đề của bạn..."
                        rows={5}
                        value={form.message}
                        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                        required
                        className="resize-none"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={submitting || !isAuthenticated}
                      className="w-full md:w-auto gap-2 font-bold shadow-md shadow-primary/20"
                    >
                      {submitting ? (
                        <>
                          <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Gửi yêu cầu
                        </>
                      )}
                    </Button>
                    {!isAuthenticated && (
                      <p className="text-xs text-muted-foreground">
                        Bạn cần đăng nhập trước khi gửi ticket. Sau khi đăng nhập, có thể theo dõi tại `/dashboard/support`.
                      </p>
                    )}
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Contact info */}
            <div className="flex flex-col gap-4 items-center text-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="size-4" />
                <span>support@nexedu.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <span>Phản hồi trong 24 giờ làm việc (Thứ 2 - Thứ 6)</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
