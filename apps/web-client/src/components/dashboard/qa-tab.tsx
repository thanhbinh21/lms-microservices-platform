'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, HelpCircle, Loader2, MessageSquare, Plus, Search, Send, ThumbsUp, X } from 'lucide-react';
import { createQuestionAction, listQuestionsAction, type QuestionListItem } from '@/app/actions/qa';
import { getMyEnrollmentsAction } from '@/app/actions/student';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';

interface QaTabProps {
  courseId?: string;
  lessonId?: string;
  showFullPageLink?: boolean;
  fullPageHref?: string;
}

type QaStatus = 'all' | 'unanswered' | 'resolved';

function friendlyQaError(message?: string) {
  if (!message) return 'Không thể tải hỏi đáp. Vui lòng thử lại.';
  if (message.toLowerCase().includes('forbidden')) return 'Bạn không có quyền xem câu hỏi của khóa học này.';
  if (message.toLowerCase().includes('limit')) return 'Bộ lọc hỏi đáp chưa hợp lệ. Hệ thống đã giới hạn tối đa 30 câu hỏi mỗi lần tải.';
  return message;
}

export function QaTab({ courseId: forcedCourseId, lessonId: forcedLessonId, showFullPageLink = true, fullPageHref = '/dashboard/qa' }: QaTabProps) {
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<QaStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [enrolledCourses, setEnrolledCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(forcedCourseId || '');
  const [courseLoading, setCourseLoading] = useState(true);

  const isEmbedded = Boolean(forcedCourseId);
  const selectedCourse = enrolledCourses.find((course) => course.id === selectedCourseId);

  const refreshQuestions = async () => {
    setLoading(true);
    setErrorMessage('');
    const res = await listQuestionsAction({
      page: 1,
      limit: 20,
      status,
      search: search.trim() || undefined,
      courseId: selectedCourseId || undefined,
      lessonId: forcedLessonId || undefined,
    });
    if (res.success && res.data) {
      setItems(res.data.items);
    } else {
      const message = friendlyQaError(res.message);
      setErrorMessage(message);
      setItems([]);
      toast('error', 'Không thể tải hỏi đáp', message);
    }
    setLoading(false);
  };

  const loadEnrolledCourses = async () => {
    setCourseLoading(true);
    const res = await getMyEnrollmentsAction();
    if (res.success && res.data) {
      setEnrolledCourses(res.data.map((enrollment: { id: string; title?: string }) => ({ id: enrollment.id, title: enrollment.title || 'Khóa học' })));
    } else {
      toast('error', 'Không thể tải khóa học', res.message || 'Vui lòng thử lại.');
    }
    setCourseLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshQuestions();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, status, selectedCourseId, forcedLessonId]);

  useEffect(() => {
    if (!forcedCourseId) {
      void loadEnrolledCourses();
    } else {
      setCourseLoading(false);
    }
  }, [forcedCourseId]);

  const stats = useMemo(() => ({
    total: items.length,
    unanswered: items.filter((question) => question.answerCount === 0 && !question.isResolved).length,
    resolved: items.filter((question) => question.isResolved).length,
  }), [items]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    const courseId = forcedCourseId || selectedCourseId;
    if (!courseId) {
      toast('error', 'Chưa chọn khóa học', 'Vui lòng chọn khóa học trước khi đặt câu hỏi.');
      return;
    }
    if (title.length < 6 || content.length < 10) {
      toast('error', 'Câu hỏi chưa hợp lệ', 'Tiêu đề cần ít nhất 6 ký tự và nội dung cần ít nhất 10 ký tự.');
      return;
    }

    setSubmitting(true);
    const res = await createQuestionAction({
      title,
      content,
      courseId,
      lessonId: forcedLessonId || undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      toast('error', 'Đăng câu hỏi thất bại', friendlyQaError(res.message));
      return;
    }
    toast('success', 'Đã đăng câu hỏi');
    setShowCreateModal(false);
    setNewTitle('');
    setNewContent('');
    await refreshQuestions();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <HelpCircle className="size-4 text-primary" />
              {isEmbedded ? 'Hỏi đáp bài học này' : 'Hỏi đáp khóa học'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEmbedded ? 'Câu hỏi được gắn với bài học hiện tại.' : 'Chọn khóa học, lọc trạng thái và tìm lại câu hỏi của bạn.'}
            </p>
          </div>
          {!isEmbedded && (
            <Button size="sm" className="gap-1.5 rounded-xl font-semibold" onClick={() => setShowCreateModal(true)}>
              <Plus className="size-3.5" />
              Đặt câu hỏi
            </Button>
          )}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Đang hiển thị', stats.total],
            ['Chưa trả lời', stats.unanswered],
            ['Đã giải quyết', stats.resolved],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold">{loading ? '...' : value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-xl border border-input bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="Tìm theo tiêu đề câu hỏi..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {!isEmbedded && (
            <select
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-medium"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              disabled={courseLoading}
              aria-label="Lọc theo khóa học"
            >
              <option value="">{courseLoading ? 'Đang tải khóa học...' : 'Tất cả khóa học'}</option>
              {enrolledCourses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          )}
          <select
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-medium"
            value={status}
            onChange={(event) => setStatus(event.target.value as QaStatus)}
            aria-label="Lọc trạng thái câu hỏi"
          >
            <option value="all">Tất cả</option>
            <option value="unanswered">Chưa trả lời</option>
            <option value="resolved">Đã giải quyết</option>
          </select>
          {showFullPageLink && (
            <Button asChild variant="outline" className="rounded-xl text-xs font-semibold">
              <Link href={fullPageHref}>Xem trang đầy đủ</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card className="rounded-xl border-transparent p-5 text-center">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Đang tải câu hỏi...</p>
          </Card>
        ) : errorMessage ? (
          <Card className="rounded-xl border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-800">
            {errorMessage}
          </Card>
        ) : items.length === 0 ? (
          <Card className="rounded-xl border-2 border-dashed py-10 text-center">
            <HelpCircle className="mx-auto mb-3 size-10 text-muted-foreground/30" />
            <p className="font-semibold text-slate-600">Chưa có câu hỏi phù hợp</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status !== 'all' || search || selectedCourseId ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Khi bạn đặt câu hỏi cho khóa học, câu hỏi sẽ xuất hiện tại đây.'}
            </p>
          </Card>
        ) : (
          items.map((question) => (
            <Link key={question.id} href={`/qa/${question.id}`}>
              <Card className="rounded-xl border-transparent p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-bold leading-snug">{question.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{question.content}</p>

                    {question.course && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          <BookOpen className="size-3" />
                          {question.course.title}
                        </span>
                        {question.lesson && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {question.lesson.title}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {question.isResolved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3" /> Đã giải quyết
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Chờ giải đáp
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium">
                    {question.author.displayName}
                    {(question.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
                  </span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{question.answerCount} trả lời</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3" />{question.upvoteCount}</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={(event) => { if (event.target === event.currentTarget) setShowCreateModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-question-title" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 id="create-question-title" className="text-lg font-bold text-slate-800">Đặt câu hỏi mới</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 transition-colors hover:bg-slate-100" aria-label="Đóng">
                <X className="size-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="q-course">Khóa học</label>
                <select
                  id="q-course"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  disabled={courseLoading}
                >
                  <option value="">{courseLoading ? 'Đang tải khóa học...' : 'Chọn khóa học...'}</option>
                  {enrolledCourses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
                {selectedCourse && <p className="mt-1 text-xs text-muted-foreground">Câu hỏi sẽ được gửi trong khóa: {selectedCourse.title}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="q-title">Tiêu đề câu hỏi</label>
                <input
                  id="q-title"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="VD: Vì sao bài tập của mình chưa chạy đúng?"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="q-content">Nội dung chi tiết</label>
                <textarea
                  id="q-content"
                  value={newContent}
                  onChange={(event) => setNewContent(event.target.value)}
                  className="min-h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="Mô tả vấn đề bạn gặp, bạn đã thử gì và kết quả mong đợi là gì."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Hủy</Button>
                <Button onClick={handleCreate} disabled={submitting || !selectedCourseId || newTitle.trim().length < 6 || newContent.trim().length < 10}>
                  {submitting ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Đang đăng...</> : <><Send className="mr-1.5 size-3.5" />Đăng câu hỏi</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
