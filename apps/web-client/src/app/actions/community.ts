'use server';

import { callApi } from '@/lib/api-client';

const COMMUNITY_PREFIX =
  process.env.NEXT_PUBLIC_COMMUNITY_PREFIX || '/community';

export interface CommunityGroupCourseDto {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface CommunityGroupDto {
  id: string;
  type: 'PUBLIC' | 'COURSE_PRIVATE';
  courseId: string | null;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  postCount: number;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
  course: CommunityGroupCourseDto | null;
}

export interface CommunityReplyDto {
  id: string;
  content: string;
  imageUrl?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    role?: string;
    instructorSlug?: string | null;
  };
}

export interface CommunityPostDto {
  id: string;
  content: string;
  imageUrl?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    role?: string;
    instructorSlug?: string | null;
  };
  replies: CommunityReplyDto[];
}

export interface CommunityGroupsResult {
  joinedGroups: (CommunityGroupDto & { joinedAt: string })[];
  publicGroups: CommunityGroupDto[];
}

export interface CommunityPostsResult {
  group: CommunityGroupDto;
  items: CommunityPostDto[];
  nextCursor: string | null;
}

function buildCommunityPath(path: string): string {
  return `${COMMUNITY_PREFIX}${path}`;
}

export async function getMyCommunityGroupsAction() {
  return callApi<CommunityGroupsResult>(
    buildCommunityPath('/api/community/groups'),
    { method: 'GET' },
    true,
  );
}

export async function joinCommunityGroupAction(groupId: string) {
  return callApi<{
    group: CommunityGroupDto;
    joined: boolean;
  }>(
    buildCommunityPath(`/api/community/groups/${groupId}/join`),
    { method: 'POST' },
    true,
  );
}

export async function getCommunityPostsAction(
  groupId: string,
  options?: { limit?: number; cursor?: string | null },
) {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);
  const query = params.toString();

  return callApi<CommunityPostsResult>(
    buildCommunityPath(
      `/api/community/groups/${groupId}/posts${query ? `?${query}` : ''}`,
    ),
    { method: 'GET' },
    true,
  );
}

export async function createCommunityPostAction(groupId: string, content: string, imageUrl?: string) {
  return callApi<CommunityPostDto>(
    buildCommunityPath(`/api/community/groups/${groupId}/posts`),
    {
      method: 'POST',
      body: JSON.stringify({ content, imageUrl }),
    },
    true,
  );
}

export async function replyCommunityPostAction(
  groupId: string,
  postId: string,
  content: string,
  imageUrl?: string,
) {
  return callApi<CommunityReplyDto>(
    buildCommunityPath(`/api/community/groups/${groupId}/posts/${postId}/reply`),
    {
      method: 'POST',
      body: JSON.stringify({ content, imageUrl }),
    },
    true,
  );
}

export async function toggleCommunityPostReactAction(
  groupId: string,
  postId: string,
) {
  return callApi<{ liked: boolean; likeCount: number }>(
    buildCommunityPath(`/api/community/groups/${groupId}/posts/${postId}/react`),
    { method: 'POST' },
    true,
  );
}
