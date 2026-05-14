'use server';

import { callApi } from '@/lib/api-client';

const COMMUNITY_PREFIX = process.env.NEXT_PUBLIC_COMMUNITY_PREFIX || '/community';

export interface CommunityReplyDto {
  id: string;
  content: string;
  imageUrl?: string | null;
  parentId?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  isOwner?: boolean;
  replyCount?: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    role?: string;
    instructorSlug?: string | null;
  };
}

export interface CommunityPostDto extends CommunityReplyDto {
  comments?: CommunityReplyDto[];
  replies: CommunityReplyDto[];
}

export interface CommunityPostsResult {
  posts: CommunityPostDto[];
  nextCursor: string | null;
}

export interface FeaturedMember {
  authorId: string;
  displayName: string;
  role: string;
  postCount: number;
}

function buildCommunityPath(path: string): string {
  return `${COMMUNITY_PREFIX}${path}`;
}

export async function getCommunityPostsAction(options?: { limit?: number; cursor?: string | null }) {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);
  const query = params.toString();

  return callApi<CommunityPostsResult>(
    buildCommunityPath(`/api/community/posts${query ? `?${query}` : ''}`),
    { method: 'GET' },
    true,
  );
}

export async function createCommunityPostAction(content: string, imageUrl?: string) {
  return callApi<CommunityPostDto>(
    buildCommunityPath('/api/community/posts'),
    {
      method: 'POST',
      body: JSON.stringify({ content, imageUrl }),
    },
    true,
  );
}

export async function replyCommunityPostAction(postId: string, content: string, imageUrl?: string) {
  return callApi<CommunityReplyDto>(
    buildCommunityPath(`/api/community/posts/${postId}/comments`),
    {
      method: 'POST',
      body: JSON.stringify({ content, imageUrl }),
    },
    true,
  );
}

export async function toggleCommunityPostReactAction(postId: string) {
  return callApi<{ liked: boolean; likeCount: number }>(
    buildCommunityPath(`/api/community/posts/${postId}/react`),
    { method: 'POST' },
    true,
  );
}

export async function updatePostAction(postId: string, data: { content?: string; imageUrl?: string | null }) {
  return callApi<CommunityPostDto>(
    buildCommunityPath(`/api/community/posts/${postId}`),
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    true,
  );
}

export async function deletePostAction(postId: string) {
  return callApi<{ deleted: boolean }>(
    buildCommunityPath(`/api/community/posts/${postId}`),
    { method: 'DELETE' },
    true,
  );
}

export async function getHotPostsAction() {
  const result = await getCommunityPostsAction({ limit: 50 });
  if (!result.success || !result.data) return result as unknown as Awaited<ReturnType<typeof callApi<CommunityPostDto[]>>>;
  const posts = [...result.data.posts]
    .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || (b.replyCount ?? b.replies?.length ?? 0) - (a.replyCount ?? a.replies?.length ?? 0))
    .slice(0, 5);
  return { ...result, data: posts };
}

export async function getFeaturedMembersAction() {
  const result = await getCommunityPostsAction({ limit: 50 });
  if (!result.success || !result.data) return result as unknown as Awaited<ReturnType<typeof callApi<FeaturedMember[]>>>;
  const map = new Map<string, FeaturedMember>();
  for (const post of result.data.posts) {
    const current = map.get(post.author.id) ?? {
      authorId: post.author.id,
      displayName: post.author.displayName,
      role: post.author.role ?? '',
      postCount: 0,
    };
    current.postCount += 1;
    map.set(post.author.id, current);
  }
  return { ...result, data: [...map.values()].sort((a, b) => b.postCount - a.postCount).slice(0, 5) };
}
