'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MessageSquare, Search, ThumbsUp, BookOpen, HelpCircle, Plus, X, ChevronDown, Loader2 } from 'lucide-react';
import { createQuestionAction, listQuestionsAction, type QuestionListItem } from '@/app/actions/qa';
import { getMyEnrollmentsAction } from '@/app/actions/student';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface QaTabProps {
  courseId?: string;
  lessonId?: string;
  showFullPageLink?: boolean;
  fullPageHref?: string;
}

export function QaTab({ courseId: forcedCourseId, lessonId: forcedLessonId, showFullPageLink = true, fullPageHref = '/dashboard/qa' }: QaTabProps) {
  const router = useRouter();
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'unanswered' | 'resolved'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [enrolledCourses, setEnrolledCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(forcedCourseId || '');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [courseLoading, setCourseLoading] = useState(true);

  const refreshQuestions = async () => {
    setLoading(true);
    const res = await listQuestionsAction({
      page: 1,
      limit: 20,
      status,
      search,
      courseId: selectedCourseId || undefined,
    });
    setItems(res.success && res.data ? res.data.items : []);
    setLoading(false);
  };

  const loadEnrolledCourses = async () => {
    setCourseLoading(true);
    const res = await getMyEnrollmentsAction();
    if (res.success && res.data) {
      setEnrolledCourses(res.data.map((e: any) => ({ id: e.id, title: e.title || 'Khóa học' })));
    }
    setCourseLoading(false);
  };

  useEffect(() => {
    void refreshQuestions();
  }, [search, status, selectedCourseId]);

  useEffect(() => {
    if (!forcedCourseId) {
      void loadEnrolledCourses();
    }
  }, [forcedCourseId]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    if (!forcedCourseId && !selectedCourseId) return;
    setSubmitting(true);
    const res = await createQuestionAction({
      title: newTitle,
      content: newContent,
      courseId: forcedCourseId || selectedCourseId,
      lessonId: forcedLessonId || undefined,
    });
    setSubmitting(false);
    if (!res.success) return;
    setShowCreateModal(false);
    setNewTitle('');
    setNewContent('');
    await refreshQuestions();
  };

  const selectedCourse = enrolledCourses.find((c) => c.id === selectedCourseId);

  const isEmbedded = Boolean(forcedCourseId);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            {isEmbedded ? (
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="size-4 text-primary" />
                Hỏi đáp về bài học này
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="size-4 text-primary" />
                Hỏi đáp
              </span>
            )}
          </p>
          {!isEmbedded && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="size-3.5" />
              Đặt câu hỏi
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-transparent bg-white/95 py-2 pl-9 pr-3 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30"
              placeholder="Tìm theo tiêu đề câu hỏi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Course filter — student enrolled courses */}
            {!isEmbedded && (
              <div className="relative">
                {courseLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-transparent bg-white px-3 py-2 text-sm shadow-sm">
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Đang tải...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCourseDropdownOpen((o) => !o)}
                    className="flex items-center gap-2 rounded-xl border border-transparent bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-primary/30 focus:outline-none focus:ring-primary/30"
                  >
                    <BookOpen className="size-3.5 text-muted-foreground" />
                    <span className={selectedCourse ? 'font-medium text-slate-700' : 'text-muted-foreground'}>
                      {selectedCourse ? selectedCourse.title : 'Tất cả khóa học'}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                )}
                {courseDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCourseDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={() => { setSelectedCourseId(''); setCourseDropdownOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${!selectedCourseId ? 'font-semibold text-primary' : 'text-slate-600'}`}
                      >
                        Tất cả khóa học
                      </button>
                      {enrolledCourses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCourseId(c.id); setCourseDropdownOpen(false); }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${selectedCourseId === c.id ? 'font-semibold text-primary' : 'text-slate-600'}`}
                        >
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <select
              className="rounded-xl border border-transparent bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-primary/30"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | 'unanswered' | 'resolved')}
            >
              <option value="all">Tất cả</option>
              <option value="unanswered">Chưa trả lời</option>
              <option value="resolved">Đã giải quyết</option>
            </select>
            {showFullPageLink && (
              <Link href={fullPageHref}>
                <Button variant="outline" className="rounded-xl text-xs">Xem trang đầy đủ</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card className="rounded-xl border-transparent p-5 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Đang tải câu hỏi...</p>
          </Card>
        ) : items.length === 0 ? (
          <Card className="rounded-xl border-dashed border-2 py-10 text-center">
            <HelpCircle className="mx-auto mb-3 size-10 text-muted-foreground/30" />
            <p className="font-semibold text-slate-600">Chưa có câu hỏi nào</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status !== 'all' ? 'Thử thay đổi bộ lọc trạng thái.' : 'Hãy là người đầu tiên đặt câu hỏi cho khóa học này.'}
            </p>
          </Card>
        ) : (
          items.map((q) => (
            <Link key={q.id} href={`/qa/${q.id}`}>
              <Card className="rounded-xl border-transparent p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-bold leading-snug">{q.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.content}</p>

                    {q.course && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          <BookOpen className="size-3" />
                          {q.course.title}
                        </span>
                        {q.lesson && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {q.lesson.title}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {q.isResolved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3" />Đã giải quyết
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
                    {q.author.displayName}
                    {(q.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
                  </span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" />{q.answerCount} trả lời</span>
                  <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3" />{q.upvoteCount}</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-question-title" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 id="create-question-title" className="text-lg font-bold text-slate-800">Đặt câu hỏi mới</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
                <X className="size-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Khóa học</label>
                {courseLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Đang tải khóa học...
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCourseDropdownOpen((o) => !o)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <span className={selectedCourseId ? 'font-medium text-slate-700' : 'text-muted-foreground'}>
                        {selectedCourse ? selectedCourse.title : 'Chọn khóa học...'}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </button>
                    {courseDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setCourseDropdownOpen(false)} />
                        <div className="absolute left-0 top-full mt-1.5 z-20 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                          {enrolledCourses.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedCourseId(c.id); setCourseDropdownOpen(false); }}
                              className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${selectedCourseId === c.id ? 'font-semibold text-primary' : 'text-slate-600'}`}
                            >
                              {c.title}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="q-title">Tiêu đề câu hỏi</label>
                <input
                  id="q-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="VD: Tại sao code không chạy? Mình đã thử X nhưng vẫn bị lỗi Y"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="q-content">Nội dung chi tiết</label>
                <textarea
                  id="q-content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="min-h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                  placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải: đã thử cách gì, kết quả mong đợi và thực tế ra sao."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Hủy</Button>
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !selectedCourseId || newTitle.trim().length < 6 || newContent.trim().length < 10}
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
