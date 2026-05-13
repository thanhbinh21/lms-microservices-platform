'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/redux/hooks';
import {
  getMyGroupsAction,
  createCommunityPostAction,
  getCommunityPostsAction,
  replyCommunityPostAction,
  joinCommunityGroupAction,
  toggleCommunityPostReactAction,
  updatePostAction,
  deletePostAction,
  getHotPostsAction,
  getFeaturedMembersAction,
  type CommunityPostDto,
  type CommunityMyGroupItem,
  type FeaturedMember,
} from '@/app/actions/community';
import { requestMediaUploadAction, confirmMediaUploadAction } from '@/app/actions/instructor';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Send,
  Globe,
  Users,
  ThumbsUp,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Flame,
  Star,
  Crown,
  Award,
  Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'hot';

function formatDate(dateIso: string) {
  const date = new Date(dateIso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Vua xong';
  if (mins < 60) return `${mins}p truoc`;
  if (hours < 24) return `${hours}g truoc`;
  if (days < 7) return `${days}ng truoc`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function Avatar({ name, size = 'sm', className = '' }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = size === 'lg' ? 'size-10 text-sm' : size === 'md' ? 'size-8 text-xs' : 'size-7 text-[10px]';
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary/15 to-blue-400/15 flex items-center justify-center font-bold text-primary shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  const r = (role ?? '').toUpperCase();
  if (r === 'INSTRUCTOR') return <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 border border-blue-100">GV</span>;
  if (r === 'ADMIN') return <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600 border border-purple-100">Admin</span>;
  return null;
}

// ─── Edit Post Modal ──────────────────────────────────────────────────────────

function EditPostModal({
  post,
  onSave,
  onCancel,
  saving,
}: {
  post: CommunityPostDto;
  onSave: (content: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(post.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Chinh sua bai viet</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
        </div>
        <div className="p-5">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-white"
            placeholder="Noi dung bai viet..."
          />
          <p className="mt-2 text-xs text-slate-400">{value.length}/3000</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="outline" size="sm" onClick={onCancel} className="rounded-xl">Huy</Button>
          <Button
            size="sm"
            onClick={() => onSave(value.trim())}
            disabled={!value.trim() || value.trim() === post.content || saving}
            className="gap-1.5 rounded-xl"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
            Luu thay doi
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Xac nhan xoa</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
        </div>
        <div className="p-5">
          <div className="mx-auto mb-4 size-12 rounded-full bg-rose-100 flex items-center justify-center">
            <Trash2 className="size-6 text-rose-500" />
          </div>
          <p className="text-center text-sm text-slate-600">
            Ban co chan muon xoa bai viet nay? Hanh dong nay khong the hoan tac.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="outline" size="sm" onClick={onCancel} className="rounded-xl">Huy</Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            className="gap-1.5 rounded-xl"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Xoa bai viet
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  groupId,
  onPostsUpdate,
  replyingTo,
  onReplyClick,
  onReplyClose,
  onEditClick,
  onDeleteClick,
  currentUserId,
}: {
  post: CommunityPostDto;
  groupId: string;
  onPostsUpdate: (postId: string, updated: Partial<CommunityPostDto> | null) => void;
  replyingTo: string | null;
  onReplyClick: (postId: string) => void;
  onReplyClose: () => void;
  onEditClick: (post: CommunityPostDto) => void;
  onDeleteClick: (post: CommunityPostDto) => void;
  currentUserId: string;
}) {
  const [showReplies, setShowReplies] = useState(post.replies?.length > 0);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyingTo === post.id && replyRef.current) replyRef.current.focus();
  }, [replyingTo, post.id]);

  const handleReact = async () => {
    if (reacting) return;
    setReacting(true);
    const newLiked = !post.likedByMe;
    onPostsUpdate(post.id, { likedByMe: newLiked, likeCount: (post.likeCount ?? 0) + (newLiked ? 1 : -1) });
    const res = await toggleCommunityPostReactAction(groupId, post.id);
    setReacting(false);
    if (!res.success) onPostsUpdate(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
  };

  const handleReplySubmit = async () => {
    const content = replyText.trim();
    if (!content || submittingReply) return;
    const tempReply: CommunityPostDto['replies'][number] = {
      id: `temp-${Date.now()}`, content,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      author: { id: 'me', displayName: 'Ban', role: '' }, likedByMe: false, likeCount: 0,
    };
    onPostsUpdate(post.id, { replies: [...(post.replies ?? []), tempReply] });
    setSubmittingReply(true);
    const res = await replyCommunityPostAction(groupId, post.id, content);
    setSubmittingReply(false);
    setReplyText('');
    onReplyClose();
    if (!res.success) onPostsUpdate(post.id, { replies: post.replies ?? [] });
  };

  const replies = post.replies ?? [];
  const isOwner = post.author?.id === currentUserId;

  return (
    <>
      <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <Avatar name={post.author?.displayName || 'U'} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">{post.author?.displayName || 'Nguoi dung'}</span>
                <RoleBadge role={post.author?.role} />
              </div>
              <span className="text-[11px] text-slate-400">{formatDate(post.createdAt)}</span>
            </div>
            {(isOwner || post.isOwner) && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 w-40 rounded-xl bg-white shadow-lg border border-slate-200 py-1 overflow-hidden">
                      <button
                        onClick={() => { setMenuOpen(false); onEditClick(post); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Pencil className="size-3.5" /> Chinh sua
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); onDeleteClick(post); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="size-3.5" /> Xoa bai
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{post.content}</p>

          {post.imageUrl && (
            <div className="mt-3">
              <Image src={post.imageUrl} alt="Anh dinh kem" width={800} height={600}
                className="max-h-80 rounded-xl object-cover border border-slate-100" />
            </div>
          )}

          <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
            <button
              onClick={handleReact}
              disabled={reacting}
              className={`flex items-center gap-1.5 text-sm font-medium transition-all ${post.likedByMe ? 'text-blue-500' : 'text-slate-500 hover:text-blue-500'}`}
            >
              <ThumbsUp className={`size-4 ${post.likedByMe ? 'fill-blue-500' : ''}`} />
              <span>{post.likeCount ?? 0}</span>
            </button>
            <button
              onClick={() => { onReplyClick(post.id); setShowReplies(true); }}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary transition-colors ml-4"
            >
              <MessageSquare className="size-4" />
              <span>{replies.length}</span>
            </button>
          </div>
        </div>

        {(showReplies || replyingTo === post.id) && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary mb-3 transition-colors"
              >
                {showReplies ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {showReplies ? 'An' : 'Xem'} {replies.length} phan hoi
              </button>
            )}
            {showReplies && replies.length > 0 && (
              <div className="space-y-3 mb-4">
                {replies.map((r) => (
                  <div key={r.id} className="flex gap-2.5 pl-4 border-l-2 border-slate-200">
                    <Avatar name={r.author?.displayName || 'U'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-700">{r.author?.displayName || 'Nguoi dung'}</span>
                        <RoleBadge role={r.author?.role} />
                        <span className="text-[10px] text-slate-400">{formatDate(r.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={replyRef}
                value={replyingTo === post.id ? replyText : ''}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Viet phan hoi..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary placeholder:text-slate-400"
                onFocus={(e) => { e.target.rows = 3; }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleReplySubmit(); }
                  if (e.key === 'Escape') onReplyClose();
                }}
              />
              <div className="flex flex-col gap-1">
                {replyingTo === post.id && (
                  <button onClick={onReplyClose} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
                )}
                <Button size="sm" onClick={handleReplySubmit}
                  disabled={!replyText.trim() || submittingReply} className="gap-1.5 rounded-xl">
                  {submittingReply ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                </Button>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Enter+Ctrl gui | Esc huy</p>
          </div>
        )}
      </Card>
    </>
  );
}

// ─── Hot Post Card ────────────────────────────────────────────────────────────

function HotPostCard({ post, groupId }: { post: CommunityPostDto; groupId: string }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likeCount ?? 0);
  const [reacting, setReacting] = useState(false);

  const handleReact = async () => {
    setReacting(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    const res = await toggleCommunityPostReactAction(groupId, post.id);
    setReacting(false);
    if (!res.success) { setLiked(!newLiked); setCount((c) => c + (newLiked ? -1 : 1)); }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
      <div className="shrink-0">
        <Avatar name={post.author?.displayName || 'U'} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-primary transition-colors">
          {post.content}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400">{post.author?.displayName}</span>
          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
            <ThumbsUp className="size-2.5" /> {count}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
            <MessageSquare className="size-2.5" /> {post.replies?.length ?? 0}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); void handleReact(); }}
        disabled={reacting}
        className={`shrink-0 p-1.5 rounded-lg transition-colors ${liked ? 'text-blue-500 bg-blue-50' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
      >
        <ThumbsUp className={`size-4 ${liked ? 'fill-blue-500' : ''}`} />
      </button>
    </div>
  );
}

// ─── Featured Members ─────────────────────────────────────────────────────────

function FeaturedMembers({ members, loading }: { members: FeaturedMember[]; loading: boolean }) {
  const icons = [Crown, Award, Star, Star, Star];
  const colors = ['text-amber-500 bg-amber-50', 'text-purple-500 bg-purple-50', 'text-blue-500 bg-blue-50', 'text-slate-500 bg-slate-50', 'text-slate-400 bg-slate-50'];

  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Star className="size-4 text-amber-500 fill-amber-100" />
        <h3 className="text-sm font-bold text-slate-800">Thanh vien noi bat</h3>
      </div>
      <div className="p-2">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-slate-400" /></div>
        ) : members.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">Chua co du lieu</p>
        ) : (
          members.map((m, i) => {
            const Icon = icons[i] ?? Star;
            const color = colors[i] ?? colors[4];
            return (
              <div key={m.authorId} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={`size-7 rounded-full flex items-center justify-center ${color}`}>
                  <Icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.displayName}</p>
                  <p className="text-[11px] text-slate-400">{m.postCount} bai viet</p>
                </div>
                <RoleBadge role={m.role} />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

// ─── Group Selector ────────────────────────────────────────────────────────────

function GroupSelector({ groups, active, onChange }: {
  groups: CommunityMyGroupItem[];
  active: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = groups.find((g) => g.id === active);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <Globe className="size-4 text-primary" />
        <span className="max-w-36 truncate">{current?.name || 'Chon nhom'}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-72 rounded-xl bg-white shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chon nhom</p>
            </div>
            {groups.filter((g) => !g.isArchived).map((g) => (
              <button
                key={g.id}
                onClick={() => { onChange(g.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${g.id === active ? 'bg-primary/5' : ''}`}
              >
                <div className={`size-2 rounded-full shrink-0 ${g.type === 'GLOBAL' ? 'bg-green-500' : 'bg-purple-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{g.name}</span>
                    {g.type === 'GLOBAL' && <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-600">Global</span>}
                    {g.type === 'COURSE_PRIVATE' && <span className="inline-flex items-center rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">Khoa hoc</span>}
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Users className="size-3" />{g.memberCount} thanh vien
                  </span>
                </div>
                {g.id === active && <CheckCircle2 className="size-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAppSelector((s) => s.auth);

  const [myGroups, setMyGroups] = useState<CommunityMyGroupItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPostDto[]>([]);
  const [hotPosts, setHotPosts] = useState<CommunityPostDto[]>([]);
  const [featuredMembers, setFeaturedMembers] = useState<FeaturedMember[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingHot, setLoadingHot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [composerValue, setComposerValue] = useState('');
  const [composerImageUrl, setComposerImageUrl] = useState('');
  const [composerImageFile, setComposerImageFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Edit/Delete state
  const [editingPost, setEditingPost] = useState<CommunityPostDto | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingPost, setDeletingPost] = useState<CommunityPostDto | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeGroup = myGroups.find((g) => g.id === activeGroupId) ?? null;

  // Load groups
  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    const res = await getMyGroupsAction();
    setLoadingGroups(false);
    if (res.success && res.data) {
      setMyGroups(res.data);
      if (res.data.length > 0 && !activeGroupId) setActiveGroupId(res.data[0].id);
    }
  }, [activeGroupId]);

  // Load posts + hot + featured
  const loadPosts = useCallback(async () => {
    if (!activeGroupId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setTab('all');

    const [postsRes, hotRes, membersRes] = await Promise.all([
      getCommunityPostsAction(activeGroupId),
      getHotPostsAction(activeGroupId),
      getFeaturedMembersAction(activeGroupId),
    ]);

    setLoading(false);

    if (postsRes.success && postsRes.data) {
      setPosts(postsRes.data.posts ?? []);
      setNextCursor(postsRes.data.nextCursor);
    } else {
      setError(postsRes.message || 'Khong the tai bai viet');
    }

    if (hotRes.success && hotRes.data) setHotPosts(hotRes.data);
    if (membersRes.success && membersRes.data) setFeaturedMembers(membersRes.data);
  }, [activeGroupId]);

  const loadMore = async () => {
    if (!nextCursor || !activeGroupId || loadingMore) return;
    setLoadingMore(true);
    const res = await getCommunityPostsAction(activeGroupId, { cursor: nextCursor });
    setLoadingMore(false);
    if (res.success && res.data) {
      setPosts((prev) => [...prev, ...(res.data!.posts ?? [])]);
      setNextCursor(res.data.nextCursor);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    void loadGroups();
  }, [authLoading, isAuthenticated, loadGroups, router]);

  useEffect(() => {
    if (activeGroupId) void loadPosts();
  }, [activeGroupId, loadPosts]);

  const handlePostsUpdate = (postId: string, updated: Partial<CommunityPostDto> | null) => {
    if (updated === null) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setHotPosts((prev) => prev.filter((p) => p.id !== postId));
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updated } : p)));
    setHotPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updated } : p)));
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const presigned = await requestMediaUploadAction({
        filename: file.name, mimeType: file.type || 'image/jpeg', size: file.size, type: 'IMAGE',
      });
      if (!presigned.success || !presigned.data) {
        setError('Loi lay presigned URL'); return null;
      }
      let ok = false;
      if (presigned.data.uploadMethod === 'POST_FORM' && presigned.data.uploadFields) {
        const fd = new FormData();
        Object.entries(presigned.data.uploadFields).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append('file', file);
        const r = await fetch(presigned.data.presignedUrl, { method: 'POST', body: fd });
        ok = r.ok;
        if (!ok) { const t = await r.text(); setError('Upload that bai: ' + t.slice(0, 100)); }
      } else {
        const r = await fetch(presigned.data.presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        ok = r.ok;
        if (!ok) { const t = await r.text(); setError('Upload that bai: ' + t.slice(0, 100)); }
      }
      if (!ok) return null;
      const confirmed = await confirmMediaUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) { setError('Xac nhan that bai'); return null; }
      return confirmed.data.url;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerImageFile(file);
    const url = await uploadImage(file);
    if (url) setComposerImageUrl(url);
  };

  const handleCreatePost = async () => {
    const content = composerValue.trim();
    if (!content || !activeGroupId || posting) return;
    if (activeGroup?.isArchived) return;
    const tempPost: CommunityPostDto = {
      id: `temp-${Date.now()}`, content, imageUrl: composerImageUrl || undefined,
      likeCount: 0, likedByMe: false, isOwner: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      author: { id: user?.id ?? 'me', displayName: user?.name ?? 'Ban', role: '' },
      replies: [],
    };
    setPosts((prev) => [tempPost, ...prev]);
    setComposerValue(''); setComposerImageUrl(''); setComposerImageFile(null); setComposerFocused(false);
    setPosting(true);
    const res = await createCommunityPostAction(activeGroupId, content, composerImageUrl || undefined);
    setPosting(false);
    if (res.success && res.data) {
      setPosts((prev) => prev.map((p) => (p.id === tempPost.id ? { ...res.data!, replies: [] } : p)));
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== tempPost.id));
      setError(res.message || 'Khong the dang bai');
      setComposerValue(content);
    }
  };

  // Edit handlers
  const handleEditSave = async () => {
    if (!editingPost || !activeGroupId || !editContent.trim()) return;
    setEditSaving(true);
    const res = await updatePostAction(activeGroupId, editingPost.id, { content: editContent.trim() });
    setEditSaving(false);
    if (res.success && res.data) {
      handlePostsUpdate(editingPost.id, { content: res.data.content });
      setEditingPost(null);
    } else {
      setError(res.message || 'Khong the luu thay doi');
    }
  };

  // Delete handlers
  const handleDeleteConfirm = async () => {
    if (!deletingPost || !activeGroupId) return;
    setDeleteDeleting(true);
    const res = await deletePostAction(activeGroupId, deletingPost.id);
    setDeleteDeleting(false);
    if (res.success) {
      handlePostsUpdate(deletingPost.id, null);
      setDeletingPost(null);
    } else {
      setError(res.message || 'Khong the xoa bai viet');
    }
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === 'hot' && hotPosts.length === 0 && activeGroupId) {
      setLoadingHot(true);
      getHotPostsAction(activeGroupId).then((res) => {
        setLoadingHot(false);
        if (res.success && res.data) setHotPosts(res.data);
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="glass-page min-h-screen">
        <SharedNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-slate-500">Dang tai...</p>
          </div>
        </div>
        <SharedFooter />
      </div>
    );
  }

  return (
    <div className="glass-page min-h-screen pb-20">
      <div className="absolute top-[-8%] right-[-5%] w-[35%] h-[40%] rounded-full bg-primary/8 blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-8%] w-[28%] h-[30%] rounded-full bg-blue-300/10 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-5xl px-4 pt-8 relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Cong dong Zync</h1>
            <p className="mt-1 text-sm text-slate-500">Giao luu, trao doi kien thuc va chia se.</p>
          </div>
          <GroupSelector groups={myGroups} active={activeGroupId} onChange={setActiveGroupId} />
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="size-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-slate-100/80 p-1 rounded-xl w-fit">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Clock className="size-4" /> Moi nhat
          </button>
          <button
            onClick={() => handleTabChange('hot')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'hot' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}
          >
            <Flame className="size-4" /> Bai viet hot
          </button>
        </div>

        {/* Content layout */}
        <div className="flex gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0">
            {/* Composer */}
            {activeGroup && !activeGroup.isArchived && (
              <Card className="mb-6 rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex gap-3">
                    <Avatar name={user?.name || 'Ban'} size="lg" />
                    <div className="flex-1">
                      <textarea
                        value={composerValue}
                        onChange={(e) => setComposerValue(e.target.value)}
                        onFocus={() => setComposerFocused(true)}
                        placeholder={`Chia se trong "${activeGroup.name}"...`}
                        rows={composerFocused || composerValue ? 4 : 1}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:bg-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleCreatePost(); }
                        }}
                      />
                      {composerImageUrl && (
                        <div className="mt-2 relative inline-block">
                          <Image src={composerImageUrl} alt="Preview" width={200} height={150}
                            className="max-h-32 rounded-xl object-cover border border-slate-200" />
                          <button onClick={() => { setComposerImageUrl(''); setComposerImageFile(null); }}
                            className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-0.5 hover:bg-slate-700">
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )}
                      {(composerFocused || composerValue) && (
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-2">
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary transition-colors">
                              {uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                              {uploadingImage ? 'Dang tai...' : 'Gan anh'}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm"
                              onClick={() => { setComposerValue(''); setComposerImageUrl(''); setComposerImageFile(null); setComposerFocused(false); }}
                              className="rounded-xl text-xs">Huy</Button>
                            <Button size="sm" onClick={handleCreatePost} disabled={!composerValue.trim() || posting}
                              className="gap-1.5 rounded-xl text-xs">
                              {posting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Dang bai
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeGroup?.isArchived && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Nhom nay da chuyen sang che do luu tru chi doc.
              </div>
            )}

            {/* Posts */}
            {tab === 'all' ? (
              posts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <MessageSquare className="size-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">Chua co bai viet nao.</p>
                  <p className="text-slate-400 text-sm mt-1">Hay la nguoi dau tien chia se!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      groupId={activeGroupId ?? ''}
                      onPostsUpdate={handlePostsUpdate}
                      replyingTo={replyingTo}
                      onReplyClick={setReplyingTo}
                      onReplyClose={() => setReplyingTo(null)}
                      onEditClick={(p) => { setEditingPost(p); setEditContent(p.content); }}
                      onDeleteClick={setDeletingPost}
                      currentUserId={user?.id ?? ''}
                    />
                  ))}
                </div>
              )
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="size-5 text-rose-500" />
                  <h2 className="text-base font-bold text-slate-800">Bai viet noi bat tuan nay</h2>
                </div>
                {loadingHot ? (
                  <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-slate-400" /></div>
                ) : hotPosts.length === 0 ? (
                  <Card className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center">
                    <p className="text-slate-500">Chua co bai viet nao trong tuan nay.</p>
                  </Card>
                ) : (
                  <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                    {hotPosts.map((post) => (
                      <HotPostCard key={post.id} post={post} groupId={activeGroupId ?? ''} />
                    ))}
                  </Card>
                )}
              </div>
            )}

            {nextCursor && tab === 'all' && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="rounded-xl font-semibold border-slate-300 px-8">
                  {loadingMore ? <><Loader2 className="mr-2 size-4 animate-spin" />Dang tai...</> : 'Xem them bai viet'}
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 shrink-0 hidden xl:block space-y-4">
            <FeaturedMembers members={featuredMembers} loading={loadingGroups} />

            {activeGroup && (
              <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <Users className="size-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Ve nhom nay</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Thanh vien</span>
                    <span className="text-sm font-bold text-slate-800">{activeGroup.memberCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Bai viet</span>
                    <span className="text-sm font-bold text-slate-800">{activeGroup.postCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Loai</span>
                    <span className={`text-sm font-bold ${activeGroup.type === 'GLOBAL' ? 'text-green-600' : 'text-purple-600'}`}>
                      {activeGroup.type === 'GLOBAL' ? 'Global' : 'Khoa hoc'}
                    </span>
                  </div>
                  {activeGroup.description && (
                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">{activeGroup.description}</p>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onSave={async (content) => {
            setEditContent(content);
            await handleEditSave();
          }}
          onCancel={() => setEditingPost(null)}
          saving={editSaving}
        />
      )}

      {deletingPost && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingPost(null)}
          deleting={deleteDeleting}
        />
      )}

      <SharedFooter />
    </div>
  );
}
