'use client';

import { useEffect, useState } from 'react';
import { Headphones, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
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

export default function DashboardSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      setStatus({ type: 'error', message: result.message || 'Không thể tải yêu cầu hỗ trợ.' });
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) || tickets[0] || null;

  async function submitTicket() {
    setStatus(null);
    setSubmitting(true);
    const result = await createSupportTicketAction({
      subject: form.subject,
      description: form.description,
      category: form.category,
      priority: form.category === 'PAYMENT' || form.category === 'SYSTEM' ? 'HIGH' : 'NORMAL',
    });
    if (result.success && result.data) {
      setStatus({ type: 'success', message: 'Đã gửi yêu cầu hỗ trợ.' });
      setForm({ subject: '', description: '', category: 'OTHER' });
      await loadTickets();
      setSelectedId(result.data.id);
    } else {
      setStatus({ type: 'error', message: result.message || 'Không thể gửi yêu cầu hỗ trợ.' });
    }
    setSubmitting(false);
  }

  async function submitReply() {
    if (!selectedTicket || !replyMessage.trim()) return;
    const result = await replySupportTicketAction(selectedTicket.id, replyMessage);
    if (result.success && result.data) {
      setReplyMessage('');
      setTickets((items) => items.map((item) => (item.id === result.data?.id ? result.data : item)));
    } else {
      setStatus({ type: 'error', message: result.message || 'Không thể gửi phản hồi.' });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
          <Headphones className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hỗ trợ hệ thống</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Gửi yêu cầu hỗ trợ về thanh toán, khóa học, tài khoản hoặc lỗi hệ thống.
          </p>
        </div>
      </div>

      {status && <StatusMessage type={status.type} message={status.message} />}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquarePlus className="size-4 text-primary" />
              Tạo yêu cầu mới
            </CardTitle>
            <CardDescription>Admin sẽ phản hồi trong cùng ticket này.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="support-subject" className="text-sm font-semibold">Tiêu đề</label>
              <Input id="support-subject" value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="VD: Tôi chưa được ghi danh sau khi thanh toán" />
            </div>
            <div className="space-y-2">
              <label htmlFor="support-category" className="text-sm font-semibold">Nhóm vấn đề</label>
              <select
                id="support-category"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as SupportTicketCategory }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả vấn đề, mã đơn hàng hoặc tên khóa học nếu có."
              />
            </div>
            <Button className="w-full rounded-xl font-bold" disabled={submitting || form.subject.trim().length < 6 || form.description.trim().length < 10} onClick={submitTicket}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Gửi yêu cầu
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Yêu cầu của tôi</CardTitle>
            <CardDescription>Theo dõi phản hồi từ admin.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Đang tải...
              </div>
            ) : tickets.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Bạn chưa gửi yêu cầu hỗ trợ nào.</p>
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
                      <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABEL[ticket.category]} - {STATUS_LABEL[ticket.status]}</p>
                    </button>
                  ))}
                </div>

                {selectedTicket && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4">
                    <div>
                      <h2 className="font-bold">{selectedTicket.subject}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {CATEGORY_LABEL[selectedTicket.category]} - {STATUS_LABEL[selectedTicket.status]} - {new Date(selectedTicket.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{selectedTicket.description}</p>
                    </div>

                    <div className="space-y-3">
                      {selectedTicket.replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-xs font-bold text-muted-foreground">
                            {reply.authorRole === 'ADMIN' ? 'Admin' : 'Bạn'} - {new Date(reply.createdAt).toLocaleString('vi-VN')}
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
                          onChange={(e) => setReplyMessage(e.target.value)}
                        />
                        <Button className="rounded-xl font-bold" disabled={replyMessage.trim().length < 2} onClick={submitReply}>
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
