'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headphones, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import { toast } from '@/components/ui/toast';
import {
  createSupportTicketAction,
  getMySupportTicketsAction,
  replySupportTicketAction,
  type SupportTicketCategory,
  type SupportTicketDto,
} from '@/app/actions/support';

const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  PAYMENT: 'Thanh toán',
  COURSE: 'Khóa học',
  ACCOUNT: 'Tài khoản',
  SYSTEM: 'Lỗi hệ thống',
  OTHER: 'Khác',
};

const STATUS_LABEL: Record<SupportTicketDto['status'], string> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
};

const STATUS_CLASS: Record<SupportTicketDto['status'], string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-700',
};

export default function DashboardSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'OTHER' as SupportTicketCategory,
  });

  async function loadTickets() {
    setLoading(true);
    const result = await getMySupportTicketsAction();
    if (result.success && result.data) {
      const data = result.data;
      setTickets(data);
      setSelectedId((current) => current || data[0]?.id || '');
    } else {
      const message = result.message || 'Không thể tải yêu cầu hỗ trợ.';
      setStatus({ type: 'error', message });
      toast('error', 'Tải hỗ trợ thất bại', message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) || tickets[0] || null;
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS').length,
    resolved: tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED').length,
  }), [tickets]);

  async function submitTicket() {
    setStatus(null);
    setSubmitting(true);
    const result = await createSupportTicketAction({
      subject: form.subject.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.category === 'PAYMENT' || form.category === 'SYSTEM' ? 'HIGH' : 'NORMAL',
    });
    if (result.success && result.data) {
      setStatus({ type: 'success', message: 'Đã gửi yêu cầu hỗ trợ.' });
      toast('success', 'Đã gửi yêu cầu hỗ trợ');
      setForm({ subject: '', description: '', category: 'OTHER' });
      await loadTickets();
      setSelectedId(result.data.id);
    } else {
      const message = result.message || 'Không thể gửi yêu cầu hỗ trợ.';
      setStatus({ type: 'error', message });
      toast('error', 'Gửi yêu cầu thất bại', message);
    }
    setSubmitting(false);
  }

  async function submitReply() {
    if (!selectedTicket || !replyMessage.trim()) return;
    setReplying(true);
    const result = await replySupportTicketAction(selectedTicket.id, replyMessage.trim());
    if (result.success && result.data) {
      setReplyMessage('');
      setTickets((items) => items.map((item) => (item.id === result.data?.id ? result.data : item)));
      toast('success', 'Đã gửi phản hồi');
    } else {
      const message = result.message || 'Không thể gửi phản hồi.';
      setStatus({ type: 'error', message });
      toast('error', 'Gửi phản hồi thất bại', message);
    }
    setReplying(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Headphones className="size-3.5" />
            Hỗ trợ
          </div>
          <h1 className="workspace-page-title">Hỗ trợ hệ thống</h1>
          <p className="workspace-page-description">
            Gửi yêu cầu về thanh toán, khóa học, tài khoản hoặc lỗi hệ thống và theo dõi phản hồi từ admin.
          </p>
        </div>
      </div>

      {status && <StatusMessage type={status.type} message={status.message} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Tổng ticket', value: stats.total, hint: 'Yêu cầu đã gửi' },
          { label: 'Đang xử lý', value: stats.open, hint: 'Mới hoặc admin đang xử lý' },
          { label: 'Đã xử lý', value: stats.resolved, hint: 'Đã giải quyết hoặc đóng' },
        ].map((item) => (
          <Card key={item.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{item.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{loading ? '...' : item.value.toLocaleString('vi-VN')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="rounded-2xl border-white/60 bg-white/60 shadow-sm backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquarePlus className="size-4 text-primary" />
              Tạo yêu cầu mới
            </CardTitle>
            <CardDescription className="text-xs">Mô tả rõ vấn đề để admin xử lý nhanh hơn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="support-subject" className="text-sm font-semibold">Tiêu đề</label>
              <Input id="support-subject" value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} placeholder="VD: Tôi chưa được ghi danh sau khi thanh toán" />
            </div>
            <div className="space-y-2">
              <label htmlFor="support-category" className="text-sm font-semibold">Nhóm vấn đề</label>
              <select
                id="support-category"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as SupportTicketCategory }))}
              >
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="support-description" className="text-sm font-semibold">Mô tả chi tiết</label>
              <textarea
                id="support-description"
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Mô tả vấn đề, mã đơn hàng hoặc tên khóa học nếu có."
              />
            </div>
            <Button className="w-full rounded-xl font-bold" disabled={submitting || form.subject.trim().length < 6 || form.description.trim().length < 10} onClick={submitTicket}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Gửi yêu cầu
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/60 shadow-sm backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">Yêu cầu của tôi</CardTitle>
            <CardDescription className="text-xs">Theo dõi phản hồi từ admin trong từng ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Đang tải ticket...
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white/40 py-12 text-center">
                <Headphones className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-semibold">Bạn chưa gửi yêu cầu hỗ trợ nào</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo ticket mới nếu cần admin hỗ trợ về thanh toán, khóa học hoặc tài khoản.</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedId(ticket.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                        selectedTicket?.id === ticket.id ? 'border-primary/30 bg-primary/10' : 'border-slate-200 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <p className="line-clamp-2 font-semibold">{ticket.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABEL[ticket.category]}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[ticket.status]}`}>
                        {STATUS_LABEL[ticket.status]}
                      </span>
                    </button>
                  ))}
                </div>

                {selectedTicket && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4">
                    <div>
                      <h2 className="font-bold">{selectedTicket.subject}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {CATEGORY_LABEL[selectedTicket.category]} · {STATUS_LABEL[selectedTicket.status]} · {new Date(selectedTicket.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{selectedTicket.description}</p>
                    </div>

                    <div className="space-y-3">
                      {selectedTicket.replies.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">Chưa có phản hồi. Admin sẽ trả lời tại đây.</p>
                      ) : selectedTicket.replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-xs font-bold text-muted-foreground">
                            {reply.authorRole === 'ADMIN' ? 'Admin' : 'Bạn'} · {new Date(reply.createdAt).toLocaleString('vi-VN')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{reply.message}</p>
                        </div>
                      ))}
                    </div>

                    {selectedTicket.status !== 'CLOSED' && (
                      <div className="space-y-2">
                        <label htmlFor="support-reply" className="text-sm font-semibold">Phản hồi thêm</label>
                        <textarea
                          id="support-reply"
                          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={replyMessage}
                          onChange={(event) => setReplyMessage(event.target.value)}
                        />
                        <Button className="rounded-xl font-bold" disabled={replying || replyMessage.trim().length < 2} onClick={submitReply}>
                          {replying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          Gửi phản hồi
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
