'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/redux/hooks';
import {
  getCommunityPostsAction,
  type CommunityPostDto,
  type CommunityPostsResult,
} from '@/app/actions/community';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MessageSquare, ArrowLeft, Globe, Lock, CheckCircle2 } from 'lucide-react';

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderAuthorName(author: { displayName: string; role?: string; instructorSlug?: string | null }) {
  const isInstructor = (author.role || '').toUpperCase() === 'INSTRUCTOR';
  const label = (
    <span className="inline-flex items-center gap-1">
      <span>{author.displayName}</span>
      {isInstructor && <CheckCircle2 className="size-3 text-blue-500" />}
    </span>
  );

  if (isInstructor && author.instructorSlug) {
    return (
      <Link href={`/instructors/${author.instructorSlug}`} className="hover:text-primary">
        {label}
      </Link>
    );
  }

  return label;
}

function GroupHeader({
  group,
}: {
  group: CommunityPostsResult['group'];
}) {
  const isPublic = group.type === 'PUBLIC';

  return (
    <Card className="glass-panel rounded-2xl border-white/60 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {isPublic ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                <Globe className="size-3" />
                Công khai
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <Lock className="size-3" />
                Riêng tư
              </span>
            )}
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Cộng đồng
            </p>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
          {group.course && (
            <p className="text-sm text-muted-foreground">{group.course.title}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <Users className="size-3.5" />
            {group.memberCount} thành viên
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <MessageSquare className="size-3.5" />
            {group.postCount} bài viết
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function CommunityGroupPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.auth);

  const [group, setGroup] = useState<CommunityPostsResult['group'] | null>(null);
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReadOnlyArchive = true;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getCommunityPostsAction(groupId, { limit: 20 });
    if (!result.success || !result.data) {
      setError(result.message || 'Không thể tải bài viết');
      setLoading(false);
      return;
    }
    setGroup(result.data.group);
    setPosts(result.data.items);
    setNextCursor(result.data.nextCursor);
    setLoading(false);
  }, [groupId]);

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

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    const result = await getCommunityPostsAction(groupId, {
      limit: 20,
      cursor: nextCursor || undefined,
    });
    setLoadingMore(false);
    if (!result.success || !result.data) {
      setError(result.message || 'Không thể tải thêm bài viết');
      return;
    }
    const nextData = result.data;
    setPosts((prev) => [...prev, ...nextData.items]);
    setNextCursor(nextData.nextCursor);
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
            Đang tải thảo luận...
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
            Quay lại Dashboard
          </Link>
          {group?.course ? (
            <Link href={`/courses/${group.course.slug}`} className="text-sm font-semibold text-primary hover:underline">
              Xem khóa học
            </Link>
          ) : null}
        </div>

        {group ? <GroupHeader group={group} /> : null}

        {group?.type === 'PUBLIC' && (
          <Card className="rounded-2xl border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Khu community cũ đã chuyển sang chế độ lưu trữ chỉ đọc. Vui lòng dùng Global Q&A để tạo nội dung mới.
          </Card>
        )}

        {error ? (
          <Card className="rounded-2xl border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </Card>
        ) : null}

        <div className="space-y-4">
          {sortedPosts.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-muted-foreground">
              Chưa có bài viết nào. Hãy là người mở màn cuộc thảo luận đầu tiên!
            </Card>
          ) : null}

          {sortedPosts.map((post) => (
            <Card key={post.id} className="glass-panel rounded-2xl border-white/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{renderAuthorName(post.author)}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {formatDate(post.createdAt)}
                  </p>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                {post.content}
              </p>

              {post.imageUrl && (
                <div className="mt-4 -mx-6 sm:mx-0">
                  <Image src={post.imageUrl} alt="Ảnh đính kèm bài viết" width={1200} height={900} className="w-full max-h-96 object-cover border border-slate-100 sm:rounded-2xl" />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
                <span>{post.likeCount || 0} lượt thích</span>
                <span>{post.replies.length} bình luận</span>
              </div>

              {post.replies.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  {post.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-700">{renderAuthorName(reply.author)}</p>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {formatDate(reply.createdAt)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[14px] text-slate-800 leading-relaxed">{reply.content}</p>
                      {reply.imageUrl && (
                        <Image src={reply.imageUrl} alt="Ảnh đính kèm phản hồi" width={800} height={600} className="mt-2 max-h-48 rounded-xl object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {isReadOnlyArchive ? null : null}
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
                  Đang tải thêm
                </>
              ) : (
                'Tải thêm bài viết'
              )}
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
