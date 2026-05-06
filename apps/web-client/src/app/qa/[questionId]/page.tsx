'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ThumbsUp } from 'lucide-react';
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

  return (
    <div className="glass-page min-h-screen pb-16">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
        <Link href="/dashboard/qa" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Quay lại Q&A
        </Link>
        {!question ? (
          <Card className="border-transparent p-4 shadow-sm">Không tìm thấy câu hỏi.</Card>
        ) : (
          <>
            <Card className="space-y-3 border-transparent p-5 shadow-sm">
              <h1 className="text-2xl font-bold">{question.title}</h1>
              <p className="text-sm text-muted-foreground">{question.content}</p>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                {question.author.displayName}
                {(question.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span>{question.upvoteCount} upvote</span>
                <span>{question.answers.length} trả lời</span>
                {question.isResolved && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3" />Đã giải quyết</span>}
              </div>
              <Button size="sm" variant="outline" onClick={async () => { await upvoteQuestionAction(question.id); await reload(); }}>
                <ThumbsUp className="mr-2 size-4" />Upvote câu hỏi
              </Button>
            </Card>
            <Card className="space-y-3 border-transparent p-5 shadow-sm">
              <h2 className="font-bold">Câu trả lời</h2>
              {question.answers.map((a) => (
                <div key={a.id} className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-200">
                  <p className="mb-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    {a.author.displayName}
                    {(a.author.role || '').toUpperCase() === 'INSTRUCTOR' && <CheckCircle2 className="size-3 text-blue-500" />}
                  </p>
                  <p className="text-sm">{a.content}</p>
                  {editingAnswerId === a.id && (
                    <div className="mt-2 space-y-2">
                      <textarea className="min-h-20 w-full rounded-lg border border-transparent p-2 text-sm shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30" value={editingContent} onChange={(e) => setEditingContent(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={async () => { await updateAnswerAction(a.id, { content: editingContent }); setEditingAnswerId(null); await reload(); }}>Lưu</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingAnswerId(null)}>Hủy</Button>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={async () => { await upvoteAnswerAction(a.id); await reload(); }}>
                      <ThumbsUp className="mr-1 size-3" /> {a.upvoteCount}
                    </Button>
                    {!a.isAccepted && (
                      <Button size="sm" onClick={async () => { await acceptAnswerAction(question.id, a.id); await reload(); }}>
                        Chọn câu trả lời đúng
                      </Button>
                    )}
                    {a.isAccepted && <span className="text-xs font-semibold text-emerald-600">Đã được chọn</span>}
                    {user?.id === a.author.id && editingAnswerId !== a.id && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditingAnswerId(a.id); setEditingContent(a.content); }}>
                          Sửa
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => { await deleteAnswerAction(a.id); await reload(); }}>
                          Xóa
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <textarea value={answerContent} onChange={(e) => setAnswerContent(e.target.value)} className="min-h-24 w-full rounded-xl border border-transparent p-3 shadow-sm outline-none ring-1 ring-slate-200 focus:ring-primary/30" placeholder="Viết câu trả lời..." />
              <Button onClick={async () => { if (!answerContent.trim()) return; await createAnswerAction(question.id, { content: answerContent }); setAnswerContent(''); await reload(); }}>
                Gửi câu trả lời
              </Button>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
