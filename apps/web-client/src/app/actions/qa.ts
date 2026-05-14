'use server';

import { callApi } from '@/lib/api-client';

const QA_PREFIX = process.env.NEXT_PUBLIC_QA_PREFIX || '/qa';

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
  upvotedByMe?: boolean;
  course: { id: string; title: string; slug: string } | null;
  lesson: { id: string; title: string } | null;
  author: QaAuthor;
  // Latest answer (for course page)
  latestAnswer?: {
    id: string;
    content: string;
    createdAt: string;
    author: QaAuthor;
  } | null;
}

export interface QuestionDetail extends Omit<QuestionListItem, 'answerCount' | 'latestAnswer'> {
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
  lessonId?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.courseId) query.set('courseId', params.courseId);
  if (params?.lessonId) query.set('lessonId', params.lessonId);
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return callApi<{ items: QuestionListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    `${QA_PREFIX}/api/qa/questions${suffix}`,
    { method: 'GET' },
    true,
  );
}

// Lay cau hoi cua 1 course (cho trang hoc /learn/[courseId])
export async function getCourseQuestionsAction(courseId: string, params?: {
  page?: number;
  limit?: number;
  status?: 'all' | 'unanswered' | 'resolved';
  lessonId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.lessonId) query.set('lessonId', params.lessonId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return callApi<{
    items: QuestionListItem[];
    course: { id: string; title: string; slug: string } | null;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(
    `${QA_PREFIX}/api/qa/course/${courseId}/questions${suffix}`,
    { method: 'GET' },
    true,
  );
}

export async function getQuestionDetailAction(id: string) {
  return callApi<QuestionDetail>(
    `${QA_PREFIX}/api/qa/questions/${id}`,
    { method: 'GET' },
    true,
  );
}

export async function createQuestionAction(payload: {
  title: string;
  content: string;
  courseId: string;
  lessonId?: string | null;
}) {
  return callApi<QuestionDetail>(
    `${QA_PREFIX}/api/qa/questions`,
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  );
}

export async function createAnswerAction(questionId: string, payload: { content: string }) {
  return callApi<unknown>(
    `${QA_PREFIX}/api/qa/questions/${questionId}/answers`,
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  );
}

export async function acceptAnswerAction(questionId: string, answerId: string) {
  return callApi<unknown>(
    `${QA_PREFIX}/api/qa/questions/${questionId}/answers/${answerId}/accept`,
    { method: 'PUT' },
    true,
  );
}

export async function upvoteQuestionAction(questionId: string) {
  return callApi<{ upvoted: boolean }>(
    `${QA_PREFIX}/api/qa/questions/${questionId}/upvote`,
    { method: 'POST' },
    true,
  );
}

export async function upvoteAnswerAction(answerId: string) {
  return callApi<{ upvoted: boolean }>(
    `${QA_PREFIX}/api/qa/answers/${answerId}/upvote`,
    { method: 'POST' },
    true,
  );
}

export async function updateAnswerAction(answerId: string, payload: { content: string }) {
  return callApi<unknown>(
    `${QA_PREFIX}/api/qa/answers/${answerId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    true,
  );
}

export async function deleteAnswerAction(answerId: string) {
  return callApi<unknown>(
    `${QA_PREFIX}/api/qa/answers/${answerId}`,
    { method: 'DELETE' },
    true,
  );
}

export async function getQaCountAction() {
  return callApi<{ unansweredCount: number }>(
    `${QA_PREFIX}/api/qa/count`,
    { method: 'GET' },
    true,
  );
}

export async function getInstructorQaCoursesAction() {
  return callApi<{ courses: Array<{ id: string; title: string; slug: string }> }>(
    `${QA_PREFIX}/api/qa/instructor/courses`,
    { method: 'GET' },
    true,
  );
}
