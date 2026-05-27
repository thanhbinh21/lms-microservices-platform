'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Search, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  createAnswerAction,
  getInstructorQaCoursesAction,
  listQuestionsAction,
  type QuestionListItem,
} from '@/app/actions/qa';

type QaStatus = 'all' | 'unanswered' | 'resolved';

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export default function InstructorQaPage() {
  const [courses, setCourses] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [status, setStatus] = useState<QaStatus>('unanswered');
  const [search, setSearch] = useState('');
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [answerContent, setAnswerContent] = useState('');

  async function loadQuestions() {
    setLoading(true);
    setErrorMessage('');
    const [coursesRes, questionsRes] = await Promise.all([
      getInstructorQaCoursesAction(),
      listQuestionsAction({
        page: 1,
        limit: 50,
        status,
        courseId: selectedCourseId || undefined,
        search: search.trim() || undefined,
        sortBy: 'recent',
      }),
    ]);

    if (coursesRes.success && coursesRes.data) setCourses(coursesRes.data.courses);
    if (questionsRes.success && questionsRes.data) {
      setQuestions(questionsRes.data.items);
    } else {
      setErrorMessage(questionsRes.message || 'Không thể tải danh sách câu hỏi.');
      setQuestions([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadQuestions();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [selectedCourseId, status, search]);

  const stats = useMemo(() => {
    const unanswered = questions.filter((question) => question.answerCount === 0 && !question.isResolved).length;
    const resolved = questions.filter((question) => question.isResolved).length;
    return { total: questions.length, unanswered, resolved };
  }, [questions]);

  async function submitAnswer(questionId: string) {
    const content = answerContent.trim();
    if (content.length < 5) {
      toast('error', 'Câu trả lời quá ngắn', 'Vui lòng nhập ít nhất 5 ký tự.');
      return;
    }

    setAnswering(true);
    try {
      const result = await createAnswerAction(questionId, { content });
      if (!result.success) {
        toast('error', 'Không thể gửi câu trả lời', result.message || 'Vui lòng thử lại.');
        return;
      }
      toast('success', 'Đã gửi câu trả lời');
      setAnswerContent('');
      setActiveQuestionId('');
      await loadQuestions();
    } catch (error) {
      toast('error', 'Không thể gửi câu trả lời', getErrorMessage(error));
    } finally {
      setAnswering(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <MessageSquare className="size-3.5" />
          Học viên & tương tác
        </div>
        <h1 className="workspace-page-title">Hỏi đáp học viên</h1>
        <p className="workspace-page-description">
          Theo dõi câu hỏi thuộc các khóa học của bạn, lọc câu chưa trả lời và phản hồi trực tiếp cho học viên.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Câu hỏi đang hiển thị', value: stats.total, hint: 'Theo bộ lọc hiện tại' },
          { label: 'Chưa trả lời', value: stats.unanswered, hint: 'Cần phản hồi sớm' },
          { label: 'Đã giải quyết', value: stats.resolved, hint: 'Có câu trả lời được chấp nhận hoặc đã đóng' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-bold">{loading ? '...' : stat.value.toLocaleString('vi-VN')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Danh sách câu hỏi</CardTitle>
            <CardDescription className="text-xs">API chỉ trả về câu hỏi thuộc khóa học do bạn sở hữu.</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[720px]">
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-medium"
              aria-label="Lọc theo khóa học"
            >
              <option value="">Tất cả khóa học</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as QaStatus)}
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-medium"
              aria-label="Lọc trạng thái câu hỏi"
            >
              <option value="unanswered">Chưa trả lời</option>
              <option value="resolved">Đã giải quyết</option>
              <option value="all">Tất cả</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm câu hỏi" className="rounded-xl pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          )}

          {loading && (
            <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-border bg-white/30 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Đang tải câu hỏi...
            </div>
          )}

          {!loading && courses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-white/30 py-14 text-center">
              <BookEmptyState />
            </div>
          )}

          {!loading && courses.length > 0 && questions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-white/30 py-14 text-center">
              <MessageSquare className="mx-auto mb-3 size-9 text-muted-foreground/40" />
              <p className="text-sm font-semibold">Chưa có câu hỏi phù hợp</p>
              <p className="mt-1 text-xs text-muted-foreground">Nếu chọn “Chưa trả lời”, danh sách sẽ trống khi bạn đã xử lý hết câu hỏi.</p>
            </div>
          )}

          {!loading && questions.map((question) => {
            const isActive = activeQuestionId === question.id;
            const isAnswered = question.answerCount > 0;
            return (
              <div key={question.id} className="rounded-2xl border border-slate-200/70 bg-white/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold">{question.title}</h3>
                      {question.isResolved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="size-3" /> Đã giải quyết
                        </span>
                      ) : isAnswered ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Đã có trả lời</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Chưa trả lời</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{question.content}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {question.course?.title || 'Khóa học'} · {question.lesson?.title || 'Không gắn bài học'} · {formatDate(question.createdAt)}
                    </p>
                    {question.latestAnswer && (
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-800">
                        <p className="font-bold">Trả lời gần nhất</p>
                        <p className="mt-1 line-clamp-2">{question.latestAnswer.content}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    className="rounded-xl text-xs font-semibold"
                    onClick={() => {
                      setActiveQuestionId(isActive ? '' : question.id);
                      setAnswerContent('');
                    }}
                  >
                    {isActive ? 'Đóng trả lời' : 'Trả lời'}
                  </Button>
                </div>

                {isActive && (
                  <div className="mt-4 space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                      <p>Hệ thống sẽ kiểm tra quyền sở hữu khóa học ở backend trước khi lưu câu trả lời.</p>
                    </div>
                    <textarea
                      value={answerContent}
                      onChange={(event) => setAnswerContent(event.target.value)}
                      placeholder="Nhập câu trả lời rõ ràng, có thể kèm bước thực hiện hoặc tài liệu tham khảo."
                      className="min-h-28 w-full rounded-xl border border-input bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <div className="flex justify-end">
                      <Button type="button" className="rounded-xl font-semibold" disabled={answering || answerContent.trim().length < 5} onClick={() => void submitAnswer(question.id)}>
                        {answering ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                        Gửi câu trả lời
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function BookEmptyState() {
  return (
    <>
      <MessageSquare className="mx-auto mb-3 size-9 text-muted-foreground/40" />
      <p className="text-sm font-semibold">Chưa có khóa học để nhận câu hỏi</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Sau khi bạn tạo và xuất bản khóa học, câu hỏi từ học viên sẽ được gom tại đây theo từng khóa và trạng thái trả lời.
      </p>
    </>
  );
}
