'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquare, Search, ThumbsUp, X } from 'lucide-react';
import { createQuestionAction, listQuestionsAction, type QuestionListItem } from '@/app/actions/qa';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface QaTabProps {
  showFullPageLink?: boolean;
  fullPageHref?: string;
}

export function QaTab({ showFullPageLink = true, fullPageHref = '/dashboard/qa' }: QaTabProps) {
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'unanswered' | 'resolved'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshQuestions = async () => {
    setLoading(true);
    const res = await listQuestionsAction({ page: 1, limit: 10, status, search });
    setItems(res.success && res.data ? res.data.items : []);
    setLoading(false);
  };

  useEffect(() => {
    void refreshQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Hỏi đáp toàn hệ thống</p>
          <Button className="rounded-xl" onClick={() => setShowCreateModal(true)}>
            Đặt câu hỏi
          </Button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-transparent bg-white/95 pl-9 pr-3 py-2 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30"
            placeholder="Tìm theo tiêu đề câu hỏi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-transparent bg-white px-3 py-2 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | 'unanswered' | 'resolved')}
          >
            <option value="all">Tất cả</option>
            <option value="unanswered">Chưa trả lời</option>
            <option value="resolved">Đã giải quyết</option>
          </select>
          {showFullPageLink && (
            <Link href={fullPageHref}>
              <Button variant="outline" className="rounded-xl">Xem trang đầy đủ</Button>
            </Link>
          )}
        </div>
      </div>
      </div>
      <div className="space-y-3">
        {loading ? (
          <Card className="rounded-xl border-transparent p-4 text-sm text-muted-foreground shadow-sm">Đang tải danh sách câu hỏi...</Card>
        ) : items.length === 0 ? (
          <Card className="rounded-xl border-transparent p-4 text-sm text-muted-foreground shadow-sm">Chưa có câu hỏi nào phù hợp bộ lọc hiện tại.</Card>
        ) : (
          items.map((q) => (
            <Link key={q.id} href={`/qa/${q.id}`}>
              <Card className="rounded-xl border-transparent p-4 shadow-sm transition hover:shadow-md">
                <p className="line-clamp-2 font-bold">{q.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {q.author.displayName}
                    {(q.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
                  </span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{q.answerCount} trả lời</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3" />{q.upvoteCount} upvote</span>
                  {q.isResolved ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3" />Đã giải quyết
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                      Đang chờ giải đáp
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div role="dialog" aria-modal="true" aria-labelledby="create-question-title" className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="create-question-title" className="text-lg font-bold">Đặt câu hỏi mới</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-md p-1 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full rounded-xl border border-transparent px-3 py-2 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30" placeholder="Tiêu đề câu hỏi" />
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="min-h-32 w-full rounded-xl border border-transparent px-3 py-2 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30" placeholder="Nội dung chi tiết..." />
              <p className="text-xs text-muted-foreground">Mẹo: Nêu rõ bạn đang vướng ở đâu, đã thử gì, và mong muốn kết quả thế nào.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Hủy</Button>
                <Button
                  onClick={async () => {
                    setSubmitting(true);
                    const res = await createQuestionAction({ title: newTitle, content: newContent });
                    setSubmitting(false);
                    if (!res.success) return;
                    setShowCreateModal(false);
                    setNewTitle('');
                    setNewContent('');
                    await refreshQuestions();
                  }}
                  disabled={submitting || newTitle.trim().length < 6 || newContent.trim().length < 10}
                >
                  {submitting ? 'Đang đăng...' : 'Đăng câu hỏi'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
