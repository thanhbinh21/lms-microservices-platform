'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageSquare, ThumbsUp, BookOpen, HelpCircle, Plus, X, Loader2 } from 'lucide-react';
import { getCourseQuestionsAction, upvoteQuestionAction, createQuestionAction, type QuestionListItem } from '@/app/actions/qa';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale/vi';

interface CourseQaSectionProps {
  courseId: string;
  lessonId?: string;
  canAnswer?: boolean;
  canAsk?: boolean;
  showDashboardLink?: boolean;
}

function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: vi });
  } catch {
    return '';
  }
}

export function CourseQaSection({
  courseId,
  lessonId,
  canAnswer = false,
  canAsk = true,
  showDashboardLink = false,
}: CourseQaSectionProps) {
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'unanswered' | 'resolved'>('all');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [showAskModal, setShowAskModal] = useState(false);
  const [askTitle, setAskTitle] = useState('');
  const [askContent, setAskContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadQuestions = async (pg = 1) => {
    setLoading(true);
    const res = await getCourseQuestionsAction(courseId, {
      page: pg,
      limit: 20,
      status,
      lessonId,
    });
    if (res.success && res.data) {
      const newItems = res.data.items;
      setItems(pg === 1 ? newItems : (prev) => [...prev, ...newItems]);
      setHasMore(res.data.pagination.page < res.data.pagination.totalPages);
      setPage(pg);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadQuestions(1);
  }, [status, courseId, lessonId]);

  const handleUpvote = async (questionId: string) => {
    if (upvotingId === questionId) return;
    setUpvotingId(questionId);
    await upvoteQuestionAction(questionId);
    await loadQuestions(page);
    setUpvotingId(null);
  };

  const handleCreateQuestion = async () => {
    if (!askTitle.trim() || !askContent.trim()) return;
    setSubmitting(true);
    await createQuestionAction({
      title: askTitle,
      content: askContent,
      courseId,
      lessonId,
    });
    setSubmitting(false);
    setShowAskModal(false);
    setAskTitle('');
    setAskContent('');
    await loadQuestions(1);
  };

  const totalQuestions = items.length;
  const unansweredCount = items.filter((q) => !q.isResolved).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-primary" />
          <h3 className="text-base font-bold text-slate-800">
            Hỏi đáp
            {totalQuestions > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {totalQuestions} câu hỏi
                {unansweredCount > 0 && `, ${unansweredCount} chưa giải đáp`}
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | 'unanswered' | 'resolved')}
          >
            <option value="all">Tất cả</option>
            <option value="unanswered">Chưa trả lời</option>
            <option value="resolved">Đã giải quyết</option>
          </select>
          {canAsk && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5 text-xs font-semibold"
              onClick={() => setShowAskModal(true)}
            >
              <Plus className="size-3.5" />
              Đặt câu hỏi
            </Button>
          )}
          {showDashboardLink && (
            <Link href="/dashboard/qa">
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
                Xem tất cả
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Question list */}
      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Đang tải câu hỏi...</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-xl border-dashed border-2 py-10 text-center">
          <HelpCircle className="mx-auto mb-3 size-10 text-muted-foreground/25" />
          <p className="font-semibold text-slate-500">
            {status === 'unanswered'
              ? 'Tất cả câu hỏi đã được giải đáp.'
              : status === 'resolved'
                ? 'Chưa có câu hỏi nào được giải quyết.'
                : 'Chưa có câu hỏi nào cho bài học này.'}
          </p>
          {canAsk && (
            <Button
              size="sm"
              className="mt-4 rounded-xl gap-1.5"
              onClick={() => setShowAskModal(true)}
            >
              <Plus className="size-3.5" />
              Đặt câu hỏi đầu tiên
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <Link key={q.id} href={`/qa/${q.id}`}>
              <Card className="rounded-xl border-transparent p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-start gap-3">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await handleUpvote(q.id);
                    }}
                    disabled={upvotingId === q.id}
                    className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      q.upvotedByMe
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-500 hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    <ThumbsUp className="size-3.5" />
                    {q.upvoteCount}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">{q.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.content}</p>

                    {q.latestAnswer && (
                      <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
                        <p className="text-[11px] font-semibold text-emerald-700">
                          {q.latestAnswer.author.displayName}
                          {(q.latestAnswer.author.role || '').toUpperCase() === 'INSTRUCTOR' && (
                            <CheckCircle2 className="ml-1 inline size-3 text-blue-500" />
                          )}
                          {' · '}
                          {timeAgo(q.latestAnswer.createdAt)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{q.latestAnswer.content}</p>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium">
                        {q.author.displayName}
                        {(q.author.role || '').toUpperCase() === 'INSTRUCTOR' && (
                          <CheckCircle2 className="size-3 text-blue-500" />
                        )}
                      </span>
                      <span>·</span>
                      <span>{timeAgo(q.createdAt)}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {q.answerCount} trả lời
                      </span>
                      {q.isResolved && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          Đã giải quyết
                        </span>
                      )}
                      {!q.isResolved && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Chờ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {hasMore && (
            <button
              onClick={() => void loadQuestions(page + 1)}
              disabled={loading}
              className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-center text-xs font-semibold text-slate-500 transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {loading ? 'Đang tải...' : 'Xem thêm câu hỏi'}
            </button>
          )}
        </div>
      )}

      {/* Ask modal */}
      {showAskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAskModal(false); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="ask-modal-title" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 id="ask-modal-title" className="text-lg font-bold text-slate-800">Đặt câu hỏi</h3>
              <button onClick={() => setShowAskModal(false)} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
                <X className="size-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <BookOpen className="size-3" />
                  Câu hỏi cho khóa học này
                </span>
                {lessonId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Gắn với bài học hiện tại
                  </span>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="ask-title">
                  Tiêu đề
                </label>
                <input
                  id="ask-title"
                  value={askTitle}
                  onChange={(e) => setAskTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="Mô tả ngắn gọn vấn đề bạn gặp phải"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="ask-content">
                  Nội dung chi tiết
                </label>
                <textarea
                  id="ask-content"
                  value={askContent}
                  onChange={(e) => setAskContent(e.target.value)}
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="Mô tả chi tiết: bạn đang vướng ở đâu, đã thử cách gì, kết quả mong đợi và thực tế ra sao."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowAskModal(false)}>Hủy</Button>
                <Button
                  onClick={handleCreateQuestion}
                  disabled={submitting || askTitle.trim().length < 6 || askContent.trim().length < 10}
                >
                  {submitting ? <><Loader2 className="size-3.5 animate-spin mr-1.5" />Đang đăng...</> : 'Đăng câu hỏi'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
