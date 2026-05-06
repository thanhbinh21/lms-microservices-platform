'use server';

import { callApi } from './instructor';

const COURSE_PREFIX = '/course';

export interface QaAuthor {
  id: string;
  displayName: string;
  role?: string;
  instructorSlug?: string | null;
}

export interface QuestionListItem {
  id: string;
  title: string;
  content: string;
  isResolved: boolean;
  viewCount: number;
  upvoteCount: number;
  createdAt: string;
  updatedAt: string;
  answerCount: number;
  course: { id: string; title: string; slug: string } | null;
  author: QaAuthor;
}

export interface QuestionDetail extends Omit<QuestionListItem, 'answerCount'> {
  upvotedByMe: boolean;
  answers: Array<{
    id: string;
    content: string;
    isAccepted: boolean;
    upvoteCount: number;
    upvotedByMe: boolean;
    createdAt: string;
    updatedAt: string;
    author: QaAuthor;
  }>;
}

export async function listQuestionsAction(params?: {
  page?: number;
  limit?: number;
  status?: 'all' | 'unanswered' | 'resolved';
  sortBy?: 'recent' | 'popular' | 'upvotes';
  courseId?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.courseId) query.set('courseId', params.courseId);
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return callApi<{ items: QuestionListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `${COURSE_PREFIX}/api/questions${suffix}`,
    { method: 'GET' },
    true,
  );
}

export async function getQuestionDetailAction(id: string) {
  return callApi<QuestionDetail>(
    `${COURSE_PREFIX}/api/questions/${id}`,
    { method: 'GET' },
    true,
  );
}

export async function createQuestionAction(payload: { title: string; content: string; courseId?: string | null }) {
  return callApi<QuestionDetail>(
    `${COURSE_PREFIX}/api/questions`,
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  );
}

export async function createAnswerAction(questionId: string, payload: { content: string }) {
  return callApi<unknown>(
    `${COURSE_PREFIX}/api/questions/${questionId}/answers`,
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  );
}

export async function acceptAnswerAction(questionId: string, answerId: string) {
  return callApi<unknown>(
    `${COURSE_PREFIX}/api/questions/${questionId}/accept-answer/${answerId}`,
    { method: 'POST' },
    true,
  );
}

export async function upvoteQuestionAction(questionId: string) {
  return callApi<{ upvoted: boolean }>(
    `${COURSE_PREFIX}/api/questions/${questionId}/upvote`,
    { method: 'POST' },
    true,
  );
}

export async function upvoteAnswerAction(answerId: string) {
  return callApi<{ upvoted: boolean }>(
    `${COURSE_PREFIX}/api/answers/${answerId}/upvote`,
    { method: 'POST' },
    true,
  );
}

export async function updateAnswerAction(answerId: string, payload: { content: string }) {
  return callApi<unknown>(
    `${COURSE_PREFIX}/api/answers/${answerId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    true,
  );
}

export async function deleteAnswerAction(answerId: string) {
  return callApi<unknown>(
    `${COURSE_PREFIX}/api/answers/${answerId}`,
    { method: 'DELETE' },
    true,
  );
}
