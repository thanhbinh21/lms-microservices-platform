'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headphones, Loader2, Search, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import {
  getAdminSupportTicketsAction,
  replyAdminSupportTicketAction,
  updateAdminSupportTicketAction,
  type SupportTicketCategory,
  type SupportTicketDto,
  type SupportTicketStatus,
} from '@/app/actions/support';

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
};

const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  PAYMENT: 'Thanh toán',
  COURSE: 'Khóa học',
  ACCOUNT: 'Tài khoản',
  SYSTEM: 'Lỗi hệ thống',
  OTHER: 'Khác',
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadTickets() {
    setLoading(true);
    const result = await getAdminSupportTicketsAction({
      page: 1,
      limit: 50,
      status: statusFilter ? statusFilter as SupportTicketStatus : undefined,
      category: categoryFilter ? categoryFilter as SupportTicketCategory : undefined,
      search: search || undefined,
    });
    if (result.success && result.data) {
      const data = result.data;
      setTickets(data.items);
      setSelectedId((current) => current || data.items[0]?.id || '');
    } else {
      setMessage({ type: 'error', text: result.message || 'Không thể tải danh sách hỗ trợ.' });
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadTickets();
  }, [statusFilter, categoryFilter]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || tickets[0] || null,
    [selectedId, tickets],
  );

  async function updateTicket(status: SupportTicketStatus) {
    if (!selectedTicket) return;
    const result = await updateAdminSupportTicketAction(selectedTicket.id, { status });
    if (result.success && result.data) {
      setTickets((items) => items.map((item) => (item.id === result.data?.id ? result.data : item)));
      setMessage({ type: 'success', text: 'Đã cập nhật trạng thái ticket.' });
    } else {
      setMessage({ type: 'error', text: result.message || 'Không thể cập nhật ticket.' });
    }
  }

  async function submitReply() {
    if (!selectedTicket || replyMessage.trim().length < 2) return;
    const result = await replyAdminSupportTicketAction(selectedTicket.id, replyMessage);
    if (result.success && result.data) {
      setReplyMessage('');
      setTickets((items) => items.map((item) => (item.id === result.data?.id ? result.data : item)));
      setMessage({ type: 'success', text: 'Đã gửi phản hồi cho người dùng.' });
    } else {
      setMessage({ type: 'error', text: result.message || 'Không thể gửi phản hồi.' });
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Headphones className="size-3.5" />
          Hỗ trợ
        </div>
        <h1 className="workspace-page-title">Quản lý hỗ trợ</h1>
        <p className="workspace-page-description">
          Theo dõi và phản hồi các yêu cầu hỗ trợ từ học viên và giảng viên.
        </p>
      </div>

      {message && <div className="mb-4"><StatusMessage type={message.type} message={message.text} /></div>}

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách ticket</CardTitle>
          <CardDescription>Lọc theo trạng thái, nhóm vấn đề hoặc nội dung tìm kiếm.</CardDescription>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tiêu đề hoặc mô tả..." className="pl-9" />
            </div>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Tất cả nhóm</option>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Button variant="outline" onClick={loadTickets}>Tìm kiếm</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Đang tải...
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Không có ticket phù hợp.</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                      selectedTicket?.id === ticket.id ? 'border-primary/30 bg-primary/10' : 'border-slate-200 bg-white/60 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 font-semibold">{ticket.subject}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {STATUS_LABEL[ticket.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticket.userName || ticket.userEmail || ticket.userId.slice(0, 8)} - {CATEGORY_LABEL[ticket.category]}
                    </p>
                  </button>
                ))}
              </div>

              {selectedTicket && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-bold">{selectedTicket.subject}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedTicket.userName || selectedTicket.userEmail || selectedTicket.userId} - {CATEGORY_LABEL[selectedTicket.category]} - {new Date(selectedTicket.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((status) => (
                        <Button key={status} size="sm" variant={selectedTicket.status === status ? 'default' : 'outline'} onClick={() => updateTicket(status)}>
                          {STATUS_LABEL[status]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm">{selectedTicket.description}</p>

                  <div className="space-y-3">
                    {selectedTicket.replies.map((reply) => (
                      <div key={reply.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-bold text-muted-foreground">
                          {reply.authorRole === 'ADMIN' ? 'Admin' : reply.authorName || reply.authorEmail || 'Người dùng'} - {new Date(reply.createdAt).toLocaleString('vi-VN')}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{reply.message}</p>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status !== 'CLOSED' && (
                    <div className="space-y-2">
                      <label htmlFor="admin-support-reply" className="text-sm font-semibold">Phản hồi</label>
                      <textarea
                        id="admin-support-reply"
                        className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={replyMessage}
                        onChange={(event) => setReplyMessage(event.target.value)}
                      />
                      <Button className="rounded-xl font-bold" disabled={replyMessage.trim().length < 2} onClick={submitReply}>
                        <Send className="mr-2 size-4" />
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
  );
}


