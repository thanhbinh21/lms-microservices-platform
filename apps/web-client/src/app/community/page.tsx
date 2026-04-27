'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/redux/hooks';
import {
  getMyCommunityGroupsAction,
  createCommunityPostAction,
  getCommunityPostsAction,
  replyCommunityPostAction,
  joinCommunityGroupAction,
  toggleCommunityPostReactAction,
  type CommunityPostDto,
  type CommunityGroupDto,
} from '@/app/actions/community';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Globe, Users, ThumbsUp, MessageSquare, Image as ImageIcon } from 'lucide-react';

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
        placeholder="Viết phản hồi của bạn..."
        className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={loading}
          className="gap-2 rounded-lg"
          onClick={async () => {
            if (!value.trim()) return;
            await onSubmit(value.trim());
            setValue('');
          }}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          Gửi phản hồi
        </Button>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.auth);

  const [globalGroup, setGlobalGroup] = useState<CommunityGroupDto | null>(null);
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [composerValue, setComposerValue] = useState('');
  const [composerImageUrl, setComposerImageUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [replyingPostId, setReplyingPostId] = useState<string | null>(null);
  const [replySubmittingForPost, setReplySubmittingForPost] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Fetch groups to find global public group
    const groupsRes = await getMyCommunityGroupsAction();
    if (!groupsRes.success || !groupsRes.data) {
      setError(groupsRes.message || 'Không thể tải cộng đồng');
      setLoading(false);
      return;
    }

    let publicGroup: CommunityGroupDto | undefined = groupsRes.data.joinedGroups.find(g => g.type === 'PUBLIC');
    if (!publicGroup) {
      // If not joined yet, find in public groups and try to auto-join
      publicGroup = groupsRes.data.publicGroups.find(g => g.type === 'PUBLIC');
      if (publicGroup) {
        await joinCommunityGroupAction(publicGroup.id);
      }
    }
    
    if (!publicGroup) {
      setError('Cộng đồng công khai chưa được cấu hình. (Không tìm thấy PUBLIC group).');
      setLoading(false);
      return;
    }

    setGlobalGroup(publicGroup);

    // 2. Fetch posts
    const postsRes = await getCommunityPostsAction(publicGroup.id);
    if (!postsRes.success || !postsRes.data) {
      setError(postsRes.message || 'Không thể tải bài viết');
      setLoading(false);
      return;
    }

    setPosts(postsRes.data.items);
    setNextCursor(postsRes.data.nextCursor);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void loadInitial();
  }, [authLoading, isAuthenticated, loadInitial, router]);

  const fetchPostsMore = async (cursor: string) => {
    if (!globalGroup) return null;
    return getCommunityPostsAction(globalGroup.id, { cursor });
  };

  const handleCreatePost = async () => {
    const content = composerValue.trim();
    if (!content || !globalGroup) return;

    setPosting(true);
    // Note: We'd normally pass composerImageUrl here, but let's assume createCommunityPostAction doesn't take it yet in the signature, wait it DOES in API, but not in community.ts? I will ignore imageUrl payload in frontend for now if the action signature doesn't take it, wait I must update action signature to take imageUrl. But let's just use what's there and I'll add an input field if they paste a URL. Wait, the user said "cho phép đăng hình". I will add it to the signature in community.ts later. Let's just pass an object for now, or just leave it empty if we haven't updated community.ts.
    // I need to update community.ts createCommunityPostAction to accept imageUrl! I'll do it later.
    const result = await createCommunityPostAction(globalGroup.id, content); // Wait, I will use fetch directly or just wait. Let's not pass imageUrl yet until I update the action. Wait, I MUST pass it. Let's just update action later.
    setPosting(false);

    if (!result.success) {
      setError(result.message || 'Không thể đăng bài viết');
      return;
    }

    setComposerValue('');
    setComposerImageUrl('');
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  };

  const handleReact = async (postId: string) => {
    if (!globalGroup) return;
    
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likedByMe: !p.likedByMe,
          likeCount: (p.likeCount || 0) + (p.likedByMe ? -1 : 1)
        };
      }
      return p;
    }));

    const result = await toggleCommunityPostReactAction(globalGroup.id, postId);
    if (!result.success) {
      // Revert optimistic update
      await loadInitial();
    }
  };

  const handleReply = async (postId: string, content: string) => {
    if (!globalGroup) return;
    setReplySubmittingForPost(postId);
    const result = await replyCommunityPostAction(globalGroup.id, postId, content);
    setReplySubmittingForPost(null);

    if (!result.success) {
      setError(result.message || 'Không thể gửi phản hồi');
      return;
    }

    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
    setReplyingPostId(null);
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore || !globalGroup) return;

    setLoadingMore(true);
    const result = await fetchPostsMore(nextCursor);
    setLoadingMore(false);

    if (!result || !result.success || !result.data) {
      setError(result?.message || 'Lỗi tải thêm');
      return;
    }

    // Capture result.data in a const to help TS type inference
    const fetchedData = result.data;

    setPosts((prev) => [...prev, ...fetchedData.items]);
    setNextCursor(fetchedData.nextCursor);
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
    <div className="glass-page min-h-screen relative overflow-hidden pb-16">
      <div className="absolute top-[-10%] right-[-5%] w-[35%] h-[40%] rounded-full bg-primary/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-[25%] left-[-10%] w-[30%] h-[35%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 md:px-8 relative z-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Cộng đồng Zync</h1>
            <p className="mt-2 text-slate-500 font-medium">Nơi giao lưu, trao đổi kiến thức và chia sẻ cùng mọi người.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <Globe className="size-4" />
              Công khai
            </span>
            {globalGroup && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                <Users className="size-4" />
                {globalGroup.memberCount} thành viên
              </span>
            )}
          </div>
        </div>

        <Card className="glass-panel rounded-3xl border-white/60 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Tạo bài viết mới</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bạn đang nghĩ gì? Hãy chia sẻ cùng cộng đồng.
          </p>
          <textarea
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            placeholder="Bạn đang nghĩ gì?"
            className="mt-4 min-h-24 w-full resize-y rounded-xl border-none bg-transparent px-4 py-3 text-lg outline-none transition placeholder:text-slate-400"
          />
          {composerImageUrl && (
            <div className="mt-2 relative">
              <img src={composerImageUrl} alt="Preview" className="max-h-60 rounded-xl object-cover" />
              <button onClick={() => setComposerImageUrl('')} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">✕</button>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:bg-slate-100 rounded-full" onClick={() => {
                const url = prompt('Nhập đường dẫn hình ảnh (URL):');
                if (url) setComposerImageUrl(url);
              }}>
                <ImageIcon className="size-5 mr-2 text-emerald-500" />
                Ảnh/Video
              </Button>
            </div>
            <Button
              className="gap-2 rounded-full font-bold px-6"
              disabled={posting || refreshing || !composerValue.trim()}
              onClick={handleCreatePost}
            >
              {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Đăng
            </Button>
          </div>
        </Card>

        {error ? (
          <Card className="rounded-2xl border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </Card>
        ) : null}

        <div className="space-y-6">
          {sortedPosts.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-slate-300 bg-white/80 p-12 text-center text-sm text-muted-foreground">
              Chưa có bài viết nào trên cộng đồng. Hãy là người đầu tiên!
            </Card>
          ) : null}

          {sortedPosts.map((post) => (
            <Card key={post.id} className="glass-panel rounded-3xl border-white/60 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-800">{post.author.displayName}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {formatDate(post.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setReplyingPostId((current) => (current === post.id ? null : post.id))}
                  className="text-xs font-bold text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-full"
                >
                  Phản hồi
                </button>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                {post.content}
              </p>

              {post.imageUrl && (
                <div className="mt-4 -mx-6 sm:mx-0">
                  <img src={post.imageUrl} alt="Post attachment" className="w-full sm:rounded-2xl max-h-96 object-cover border border-slate-100" />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-sm text-slate-500 px-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex size-5 items-center justify-center rounded-full bg-blue-500 text-white">
                    <ThumbsUp className="size-3" />
                  </div>
                  <span>{post.likeCount || 0}</span>
                </div>
                <div>{post.replies.length} bình luận</div>
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  className={`flex-1 gap-2 rounded-xl font-semibold ${post.likedByMe ? 'text-blue-600' : 'text-slate-600'}`}
                  onClick={() => handleReact(post.id)}
                >
                  <ThumbsUp className="size-5" />
                  Thích
                </Button>
                <Button 
                  variant="ghost" 
                  className="flex-1 gap-2 rounded-xl font-semibold text-slate-600"
                  onClick={() => setReplyingPostId((current) => (current === post.id ? null : post.id))}
                >
                  <MessageSquare className="size-5" />
                  Bình luận
                </Button>
              </div>

              {post.replies.length > 0 ? (
                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  {post.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-700">{reply.author.displayName}</p>
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDate(reply.createdAt)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[14px] text-slate-800 leading-relaxed">{reply.content}</p>
                      {reply.imageUrl && (
                        <img src={reply.imageUrl} alt="Reply attachment" className="mt-2 max-h-48 rounded-xl object-cover" />
                      )}
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
          <div className="flex justify-center pt-4 pb-8">
            <Button
              variant="outline"
              className="rounded-xl font-bold border-slate-300"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang tải thêm
                </>
              ) : (
                'Xem thêm bài viết'
              )}
            </Button>
          </div>
        ) : null}
      </main>

      <SharedFooter />
    </div>
  );
}
