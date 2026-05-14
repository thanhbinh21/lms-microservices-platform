'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ThumbsUp, MessageSquare, Image as ImageIcon, X, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';
import {
  createCommunityPostAction,
  deletePostAction,
  getCommunityPostsAction,
  replyCommunityPostAction,
  toggleCommunityPostReactAction,
  updatePostAction,
  type CommunityPostDto,
  type CommunityReplyDto,
} from '@/app/actions/community';
import { requestMediaUploadAction, confirmMediaUploadAction } from '@/app/actions/instructor';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function formatDate(dateIso: string) {
  const date = new Date(dateIso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'U';
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  const normalized = (role ?? '').toUpperCase();
  if (normalized === 'INSTRUCTOR') return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">GV</span>;
  if (normalized === 'ADMIN') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">Admin</span>;
  return null;
}

function CommentList({ comments }: { comments: CommunityReplyDto[] }) {
  if (comments.length === 0) return null;
  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-3">
          <Avatar name={comment.author.displayName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{comment.author.displayName}</span>
              <RoleBadge role={comment.author.role} />
              <span className="text-xs text-slate-400">{formatDate(comment.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{comment.content}</p>
            {comment.imageUrl ? (
              <Image src={comment.imageUrl} alt="Ảnh bình luận" width={520} height={360} className="mt-2 max-h-56 rounded-xl object-cover" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onPatch,
  onDelete,
}: {
  post: CommunityPostDto;
  currentUserId: string;
  onPatch: (postId: string, patch: Partial<CommunityPostDto>) => void;
  onDelete: (postId: string) => void;
}) {
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const comments = post.comments ?? post.replies ?? [];
  const isOwner = post.isOwner || post.author.id === currentUserId;

  const handleReact = async () => {
    if (reacting) return;
    setReacting(true);
    const nextLiked = !post.likedByMe;
    const nextCount = Math.max(0, (post.likeCount ?? 0) + (nextLiked ? 1 : -1));
    onPatch(post.id, { likedByMe: nextLiked, likeCount: nextCount });
    const result = await toggleCommunityPostReactAction(post.id);
    setReacting(false);
    if (!result.success || !result.data) onPatch(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    else onPatch(post.id, { likedByMe: result.data.liked, likeCount: result.data.likeCount });
  };

  const handleReply = async () => {
    const content = replyText.trim();
    if (!content || replying) return;
    setReplying(true);
    const result = await replyCommunityPostAction(post.id, content);
    setReplying(false);
    if (result.success && result.data) {
      onPatch(post.id, { comments: [...comments, result.data], replies: [...comments, result.data], replyCount: (post.replyCount ?? comments.length) + 1 });
      setReplyText('');
    }
  };

  const handleSave = async () => {
    const content = editText.trim();
    if (!content || content === post.content) {
      setEditing(false);
      return;
    }
    const result = await updatePostAction(post.id, { content });
    if (result.success && result.data) onPatch(post.id, { content: result.data.content, updatedAt: result.data.updatedAt });
    setEditing(false);
  };

  const handleDelete = async () => {
    const result = await deletePostAction(post.id);
    if (result.success) onDelete(post.id);
  };

  return (
    <Card className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar name={post.author.displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{post.author.displayName}</span>
            <RoleBadge role={post.author.role} />
          </div>
          <span className="text-xs text-slate-400">{formatDate(post.createdAt)}</span>
        </div>
        {isOwner ? (
          <div className="relative">
            <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setMenuOpen((value) => !value)} aria-label="Mở menu bài viết">
              <MoreHorizontal className="size-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-8 z-10 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-md">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { setEditing(true); setMenuOpen(false); }}>
                  <Pencil className="size-4" /> Chỉnh sửa
                </button>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={handleDelete}>
                  <Trash2 className="size-4" /> Xóa bài
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Hủy</Button>
            <Button size="sm" onClick={handleSave}>Lưu</Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{post.content}</p>
      )}

      {post.imageUrl ? <Image src={post.imageUrl} alt="Ảnh bài viết" width={960} height={720} className="mt-4 max-h-96 rounded-2xl object-cover" /> : null}

      <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-500">
        <button onClick={handleReact} disabled={reacting} className={`inline-flex items-center gap-1.5 ${post.likedByMe ? 'text-blue-600' : 'hover:text-blue-600'}`}>
          <ThumbsUp className={`size-4 ${post.likedByMe ? 'fill-blue-600' : ''}`} /> {post.likeCount ?? 0}
        </button>
        <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-4" /> {post.replyCount ?? comments.length}</span>
      </div>

      <CommentList comments={comments} />

      <div className="mt-4 flex gap-2">
        <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={1} placeholder="Viết bình luận..." className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" />
        <Button size="icon" onClick={handleReply} disabled={!replyText.trim() || replying} aria-label="Gửi bình luận">
          {replying ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </Card>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAppSelector((state) => state.auth);
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = useCallback(async (cursor?: string | null) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    const result = await getCommunityPostsAction({ cursor, limit: 20 });
    if (cursor) setLoadingMore(false);
    else setLoading(false);
    if (!result.success || !result.data) {
      setError(result.message || 'Không thể tải cộng đồng');
      return;
    }
    setPosts((prev) => (cursor ? [...prev, ...result.data!.posts] : result.data!.posts));
    setNextCursor(result.data.nextCursor);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    void loadPosts();
  }, [authLoading, isAuthenticated, loadPosts, router]);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const presigned = await requestMediaUploadAction({ filename: file.name, mimeType: file.type || 'image/jpeg', size: file.size, type: 'IMAGE' });
      if (!presigned.success || !presigned.data) return null;
      let ok = false;
      if (presigned.data.uploadMethod === 'POST_FORM' && presigned.data.uploadFields) {
        const formData = new FormData();
        Object.entries(presigned.data.uploadFields).forEach(([key, value]) => formData.append(key, String(value)));
        formData.append('file', file);
        ok = (await fetch(presigned.data.presignedUrl, { method: 'POST', body: formData })).ok;
      } else {
        ok = (await fetch(presigned.data.presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })).ok;
      }
      if (!ok) return null;
      const confirmed = await confirmMediaUploadAction(presigned.data.mediaId);
      return confirmed.success ? confirmed.data?.url ?? null : null;
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setImageUrl(url);
  };

  const handleCreatePost = async () => {
    const value = content.trim();
    if (!value || posting) return;
    setPosting(true);
    const result = await createCommunityPostAction(value, imageUrl || undefined);
    setPosting(false);
    if (result.success && result.data) {
      setPosts((prev) => [{ ...result.data!, comments: [], replies: [] }, ...prev]);
      setContent('');
      setImageUrl('');
      return;
    }
    setError(result.message || 'Không thể đăng bài');
  };

  const patchPost = (postId: string, patch: Partial<CommunityPostDto>) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, ...patch } : post)));
  };

  const deletePost = (postId: string) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  return (
    <div className="glass-page min-h-screen pb-16">
      <SharedNavbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Cộng đồng</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Feed chung toàn hệ thống</h1>
          <p className="mt-2 text-sm text-muted-foreground">Mọi học viên, giảng viên và quản trị viên có thể chia sẻ, bình luận và tương tác tại đây.</p>
        </div>

        {error ? (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Đóng lỗi"><X className="size-4" /></button>
          </div>
        ) : null}

        <Card className="mb-6 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <Avatar name={user?.name || 'Bạn'} />
            <div className="flex-1">
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={4} placeholder="Bạn muốn chia sẻ điều gì với cộng đồng?" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary" />
              {imageUrl ? (
                <div className="relative mt-3 inline-block">
                  <Image src={imageUrl} alt="Ảnh xem trước" width={240} height={180} className="max-h-40 rounded-xl object-cover" />
                  <button className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white" onClick={() => setImageUrl('')} aria-label="Gỡ ảnh"><X className="size-3" /></button>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary">
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                    {uploading ? 'Đang tải ảnh...' : 'Gắn ảnh'}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
                <Button onClick={handleCreatePost} disabled={!content.trim() || posting} className="gap-2 rounded-xl">
                  {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Đăng bài
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {authLoading || loading ? (
          <Card className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center text-sm font-semibold text-muted-foreground">
            <Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary" />
            Đang tải cộng đồng...
          </Card>
        ) : posts.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-300 bg-white p-10 text-center">
            <MessageSquare className="mx-auto mb-3 size-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-800">Chưa có bài viết nào</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hãy là người đầu tiên mở cuộc trò chuyện chung.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={user?.id ?? ''} onPatch={patchPost} onDelete={deletePost} />
            ))}
          </div>
        )}

        {nextCursor ? (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => loadPosts(nextCursor)} disabled={loadingMore} className="rounded-xl">
              {loadingMore ? <><Loader2 className="mr-2 size-4 animate-spin" />Đang tải...</> : 'Xem thêm bài viết'}
            </Button>
          </div>
        ) : null}
      </main>
      <SharedFooter />
    </div>
  );
}
