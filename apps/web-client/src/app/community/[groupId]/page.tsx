'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/redux/hooks';
import {
  createCommunityPostAction,
  getCommunityPostsAction,
  replyCommunityPostAction,
  type CommunityPostDto,
  type CommunityPostsResult,
} from '@/app/actions/community';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MessageSquare, Send, ArrowLeft } from 'lucide-react';

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function GroupHeader({
  group,
}: {
  group: CommunityPostsResult['group'];
}) {
  return (
    <Card className="glass-panel rounded-2xl border-white/60 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Cong dong khoa hoc
          </p>
          <h1 className="text-2xl font-extrabold text-slate-800">{group.name}</h1>
          <p className="text-sm text-muted-foreground">{group.course.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <Users className="size-3.5" />
            {group.memberCount} thanh vien
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <MessageSquare className="size-3.5" />
            {group.postCount} bai viet
          </span>
        </div>
      </div>
    </Card>
  );
}

function ReplyComposer({
  onSubmit,
  loading,
}: {
  onSubmit: (content: string) => Promise<void>;
  loading: boolean;
}) {
  const [value, setValue] = useState('');

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Viet phan hoi cua ban..."
        className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={loading}
          className="gap-2 rounded-lg"
          onClick={async () => {
            const next = value.trim();
            if (!next) {
              return;
            }
            await onSubmit(next);
            setValue('');
          }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Gui tra loi
        </Button>
      </div>
    </div>
  );
}

export default function CommunityGroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const { isAuthenticated, isLoading: authLoading } = useAppSelector((s) => s.auth);

  const [group, setGroup] = useState<CommunityPostsResult['group'] | null>(null);
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingPostId, setReplyingPostId] = useState<string | null>(null);
  const [replySubmittingForPost, setReplySubmittingForPost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(
    async (cursor?: string | null) => {
      const result = await getCommunityPostsAction(groupId, {
        limit: 20,
        cursor: cursor || undefined,
      });

      if (!result.success || !result.data) {
        return {
          ok: false as const,
          message: result.message || 'Khong the tai bai viet',
        };
      }

      return {
        ok: true as const,
        data: result.data,
      };
    },
    [groupId],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchPosts();
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    setGroup(result.data.group);
    setPosts(result.data.items);
    setNextCursor(result.data.nextCursor);
    setLoading(false);
  }, [fetchPosts]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    void loadInitial();
  }, [authLoading, isAuthenticated, loadInitial, router]);

  const handleCreatePost = async () => {
    const content = composerValue.trim();
    if (!content) {
      return;
    }

    setPosting(true);
    const result = await createCommunityPostAction(groupId, content);
    setPosting(false);

    if (!result.success) {
      setError(result.message || 'Khong the dang bai viet');
      return;
    }

    setComposerValue('');
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  };

  const handleReply = async (postId: string, content: string) => {
    setReplySubmittingForPost(postId);
    const result = await replyCommunityPostAction(groupId, postId, content);
    setReplySubmittingForPost(null);

    if (!result.success) {
      setError(result.message || 'Khong the gui phan hoi');
      return;
    }

    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
    setReplyingPostId(null);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    const result = await fetchPosts(nextCursor);
    setLoadingMore(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setPosts((prev) => [...prev, ...result.data.items]);
    setNextCursor(result.data.nextCursor);
  };

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [posts]);

  if (authLoading || loading) {
    return (
      <div className="glass-page min-h-screen">
        <SharedNavbar />
        <div className="mx-auto flex max-w-4xl items-center justify-center px-4 py-24">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Dang tai thao luan...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-page min-h-screen pb-16">
      <SharedNavbar />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" />
            Quay lai dashboard
          </Link>
          {group ? (
            <Link href={`/courses/${group.course.slug}`} className="text-sm font-semibold text-primary hover:underline">
              Xem khoa hoc
            </Link>
          ) : null}
        </div>

        {group ? <GroupHeader group={group} /> : null}

        <Card className="glass-panel rounded-2xl border-white/60 p-5">
          <h2 className="text-base font-bold text-slate-800">Tao bai viet moi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dat cau hoi, chia se kinh nghiem va ho tro nhung hoc vien khac trong khoa hoc.
          </p>
          <textarea
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            placeholder="Viet bai dang cua ban..."
            className="mt-3 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          />
          <div className="mt-3 flex items-center justify-end">
            <Button
              className="gap-2 rounded-xl"
              disabled={posting || refreshing}
              onClick={handleCreatePost}
            >
              {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Dang bai
            </Button>
          </div>
        </Card>

        {error ? (
          <Card className="rounded-2xl border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </Card>
        ) : null}

        <div className="space-y-4">
          {sortedPosts.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-muted-foreground">
              Chua co bai viet nao. Hay la nguoi mo man cuoc thao luan dau tien.
            </Card>
          ) : null}

          {sortedPosts.map((post) => (
            <Card key={post.id} className="glass-panel rounded-2xl border-white/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{post.author.displayName}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {formatDate(post.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setReplyingPostId((current) => (current === post.id ? null : post.id))}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Phan hoi
                </button>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {post.content}
              </p>

              {post.replies.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  {post.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-700">{reply.author.displayName}</p>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {formatDate(reply.createdAt)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{reply.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {replyingPostId === post.id ? (
                <ReplyComposer
                  loading={replySubmittingForPost === post.id || refreshing}
                  onSubmit={async (content) => {
                    await handleReply(post.id, content);
                  }}
                />
              ) : null}
            </Card>
          ))}
        </div>

        {nextCursor ? (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Dang tai them
                </>
              ) : (
                'Tai them bai viet'
              )}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
