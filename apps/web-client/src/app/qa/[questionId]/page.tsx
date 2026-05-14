'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ThumbsUp, BookOpen, HelpCircle } from 'lucide-react';
import { acceptAnswerAction, createAnswerAction, deleteAnswerAction, getQuestionDetailAction, updateAnswerAction, upvoteAnswerAction, upvoteQuestionAction, type QuestionDetail } from '@/app/actions/qa';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppSelector } from '@/lib/redux/hooks';

export default function QuestionDetailPage() {
  const { user } = useAppSelector((s) => s.auth);
  const params = useParams();
  const questionId = params.questionId as string;
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [answerContent, setAnswerContent] = useState('');
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const reload = async () => {
    const res = await getQuestionDetailAction(questionId);
    setQuestion(res.success ? (res.data ?? null) : null);
  };
  useEffect(() => { void reload(); }, [questionId]);

  if (!question) {
    return (
      <div className="glass-page min-h-screen pb-16">
        <SharedNavbar />
        <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
          <Link href="/dashboard/qa" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" /> Quay lại Q&A
          </Link>
          <Card className="border-transparent p-4 shadow-sm">Không tìm thấy câu hỏi.</Card>
        </main>
      </div>
    );
  }

  const isInstructor = (user?.role || '').toUpperCase() === 'INSTRUCTOR';
  const isAdmin = (user?.role || '').toUpperCase() === 'ADMIN';
  const canAnswer = Boolean(user);

  // Routing: neu co lessonId, tra ve dung bai hoc; neu chi co courseId, tra ve trang hoc
  const backHref = question.lesson
    ? `/learn/${question.course?.id}/lesson/${question.lesson.id}`
    : question.course
      ? `/learn/${question.course.id}`
      : '/dashboard/qa';

  const backLabel = question.lesson
    ? `Quay lại: ${question.lesson.title}`
    : question.course
      ? `Quay lại: ${question.course.title}`
      : 'Quay lại Q&A';

  return (
    <div className="glass-page min-h-screen pb-16">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
        <Link href="/dashboard/qa" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Quay lại Q&A
        </Link>

        {/* Question Card */}
        <Card className="space-y-3 border-transparent p-5 shadow-sm">
          {/* Course + Lesson context */}
          {question.course && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                <BookOpen className="size-3.5" />
                {question.course.title}
              </span>
              {question.lesson && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  <HelpCircle className="size-3" />
                  {question.lesson.title}
                </span>
              )}
              {/* Routing back to lesson/course */}
              <Link href={backHref}>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20">
                  {backLabel}
                </span>
              </Link>
            </div>
          )}

          <h1 className="text-2xl font-bold">{question.title}</h1>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{question.content}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold">
              {question.author.displayName}
              {(question.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
            </span>
            <span>{question.upvoteCount} upvote</span>
            <span>{question.answers.length} trả lời</span>
            {question.isResolved && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="size-3" />Đã giải quyết
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={async () => { await upvoteQuestionAction(question.id); await reload(); }}
          >
            <ThumbsUp className="mr-1.5 size-3.5" />{question.upvotedByMe ? 'Đã upvote' : 'Upvote'}
          </Button>
        </Card>

        {/* Answers */}
        <Card className="space-y-3 border-transparent p-5 shadow-sm">
          <h2 className="font-bold">
            Câu trả lời
            {question.answers.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({question.answers.length})</span>}
          </h2>

          {question.answers.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Chưa có câu trả lời nào.</p>
          )}

          {question.answers.map((a) => (
            <div key={a.id} className="rounded-xl bg-white/80 p-4 ring-1 ring-slate-200">
              {/* Author + badge */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  {a.author.displayName}
                  {(a.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
                  {(a.author.role || '').toUpperCase() === 'ADMIN' && <CheckCircle2 className="size-3 text-red-500" />}
                </span>
                {a.isAccepted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="size-3" />Được chọn
                  </span>
                )}
              </div>

              {/* Content */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.content}</p>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => { await upvoteAnswerAction(a.id); await reload(); }}
                >
                  <ThumbsUp className="mr-1.5 size-3" />
                  {a.upvoteCount}
                  {a.upvotedByMe && ' (đã upvote)'}
                </Button>

                {/* Chon cau tra loi dung — chi author cau hoi hoac instructor */}
                {(user?.id === question.author.id || isInstructor || isAdmin) && !a.isAccepted && (
                  <Button
                    size="sm"
                    onClick={async () => { await acceptAnswerAction(question.id, a.id); await reload(); }}
                  >
                    <CheckCircle2 className="mr-1.5 size-3.5" />
                    Chọn làm câu trả lời đúng
                  </Button>
                )}

                {/* Sua / Xoa — chi author tra loi hoac admin */}
                {(user?.id === a.author.id || isAdmin) && editingAnswerId !== a.id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingAnswerId(a.id); setEditingContent(a.content); }}
                    >
                      Sửa
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => { await deleteAnswerAction(a.id); await reload(); }}
                    >
                      Xóa
                    </Button>
                  </>
                )}
              </div>

              {/* Edit form */}
              {editingAnswerId === a.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-transparent p-2 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => { await updateAnswerAction(a.id, { content: editingContent }); setEditingAnswerId(null); await reload(); }}>
                      Lưu
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingAnswerId(null)}>
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Answer form */}
          {canAnswer && (
            <div className="space-y-2 pt-2">
              <textarea
                value={answerContent}
                onChange={(e) => setAnswerContent(e.target.value)}
                className="min-h-24 w-full rounded-xl border border-transparent p-3 shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30"
                placeholder={isInstructor ? 'Viết câu trả lời của bạn...' : 'Viết câu trả lời của bạn...'}
              />
              <Button
                onClick={async () => {
                  if (!answerContent.trim()) return;
                  await createAnswerAction(question.id, { content: answerContent });
                  setAnswerContent('');
                  await reload();
                }}
                disabled={answerContent.trim().length < 2}
              >
                Gửi câu trả lời
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
