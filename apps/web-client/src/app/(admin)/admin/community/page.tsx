'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, TrendingUp, Clock3, Image as ImageIcon, Search } from 'lucide-react';
import { getCommunityPostsAction, type CommunityPostDto } from '@/app/actions/community';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';

type RoleFilter = 'ALL' | 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
type SortMode = 'LATEST' | 'POPULAR';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

function formatRelativeTime(value: string) {
  const target = new Date(value).getTime();
  const diffMinutes = Math.floor((Date.now() - target) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

function getRoleLabel(role?: string) {
  const normalized = (role || '').toUpperCase();
  if (normalized === 'INSTRUCTOR') return 'Giảng viên';
  if (normalized === 'ADMIN') return 'Quản trị viên';
  if (normalized === 'STUDENT') return 'Học viên';
  return 'Người dùng';
}

export default function AdminCommunityPage() {
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('LATEST');

  useEffect(() => {
    (async () => {
      const result = await getCommunityPostsAction({ limit: 50 });
      if (!result.success || !result.data) {
        setError(result.message || 'Không tải được dữ liệu cộng đồng.');
        setLoading(false);
        return;
      }
      setPosts(result.data.posts);
      setError('');
      setLoading(false);
    })();
  }, []);

  const summary = useMemo(() => {
    const total = posts.length;
    const withImages = posts.filter((post) => Boolean(post.imageUrl)).length;
    const totalComments = posts.reduce((sum, post) => sum + (post.replyCount ?? post.replies?.length ?? post.comments?.length ?? 0), 0);
    const totalLikes = posts.reduce((sum, post) => sum + (post.likeCount ?? 0), 0);
    return { total, withImages, totalComments, totalLikes };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const normalized = posts.filter((post) => {
      const role = (post.author.role || '').toUpperCase();
      if (roleFilter !== 'ALL' && role !== roleFilter) return false;
      if (!keyword) return true;
      const haystack = `${post.author.displayName} ${post.content}`.toLowerCase();
      return haystack.includes(keyword);
    });

    if (sortMode === 'POPULAR') {
      normalized.sort((a, b) => {
        const scoreA = (a.likeCount ?? 0) + (a.replyCount ?? 0) * 2;
        const scoreB = (b.likeCount ?? 0) + (b.replyCount ?? 0) * 2;
        return scoreB - scoreA;
      });
      return normalized;
    }

    normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return normalized;
  }, [posts, query, roleFilter, sortMode]);

  return (
    <div className="workspace-page space-y-6">
      <div>
        <h1 className="workspace-page-title">Quản trị cộng đồng</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Theo dõi bài viết cộng đồng theo thời gian thực, lọc theo vai trò và phát hiện nội dung nổi bật.
        </p>
      </div>

      {error && <StatusMessage type="error" message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader className="pb-2">
            <CardDescription>Tổng bài viết</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader className="pb-2">
            <CardDescription>Tổng bình luận</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : summary.totalComments}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader className="pb-2">
            <CardDescription>Tổng lượt thích</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : summary.totalLikes}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel rounded-2xl border-white/60">
          <CardHeader className="pb-2">
            <CardDescription>Bài viết có ảnh</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : summary.withImages}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader>
          <CardTitle className="text-lg">Bộ lọc</CardTitle>
          <CardDescription>Lọc dữ liệu để rà soát nội dung nhanh hơn.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tác giả hoặc nội dung..."
              className="pl-9"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="STUDENT">Học viên</option>
            <option value="INSTRUCTOR">Giảng viên</option>
            <option value="ADMIN">Quản trị viên</option>
          </select>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="LATEST">Mới nhất</option>
            <option value="POPULAR">Phổ biến</option>
          </select>
        </CardContent>
      </Card>

      <Card className="glass-panel rounded-2xl border-white/60">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách bài viết</CardTitle>
          <CardDescription>
            {loading ? 'Đang tải dữ liệu...' : `Hiển thị ${filteredPosts.length} / ${posts.length} bài viết`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <div key={key} className="h-24 animate-pulse rounded-xl border border-white/50 bg-white/40" />
              ))}
            </div>
          )}

          {!loading && !error && filteredPosts.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/60 bg-white/30 p-8 text-center text-sm text-muted-foreground">
              Không có bài viết phù hợp với bộ lọc hiện tại.
            </div>
          )}

          {!loading && !error && filteredPosts.map((post) => {
            const replyCount = post.replyCount ?? post.replies?.length ?? post.comments?.length ?? 0;
            const likeCount = post.likeCount ?? 0;
            return (
              <div key={post.id} className="rounded-xl border border-white/60 bg-white/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {getInitials(post.author.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{post.author.displayName}</p>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {getRoleLabel(post.author.role)}
                      </span>
                      <span className="text-xs text-muted-foreground" title={formatDateTime(post.createdAt)}>
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="size-3.5" />
                        {likeCount} lượt thích
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3.5" />
                        {replyCount} bình luận
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        {formatDateTime(post.createdAt)}
                      </span>
                      {post.imageUrl && (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <ImageIcon className="size-3.5" />
                          Có ảnh đính kèm
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}


