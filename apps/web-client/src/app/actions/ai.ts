'use server';

import { callApi, type ApiResponse } from '@/lib/api-client';

export interface AiConversationDto {
  id: string;
  userId: string;
  courseId: string;
  lessonId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface AiMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isError?: boolean;
  sources?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface AiContextStatusDto {
  available: boolean;
  sources: string[];
  transcriptStatus?: string | null;
  contentLength?: number;
  reason?: string;
}

export interface QuizQuestionDto {
  question: string;
  options: string[];
}

export interface ContextCoverageDto {
  totalLessons: number;
  lessonsWithUsableContext: number;
  coveragePercent: number;
  averageContextChars: number;
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  missingFields: string[];
  sources: string[];
}

export interface QuizQualityReportDto {
  expectedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  optionIssueCount: number;
  genericCount: number;
  answerDistribution: Record<string, number>;
  warnings: string[];
}

export interface QuizSessionDto {
  sessionId: string;
  questions: QuizQuestionDto[];
  totalQuestions?: number;
  expiresAt?: string;
  reused?: boolean;
  contextQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
  coverage?: ContextCoverageDto;
  qualityReport?: QuizQualityReportDto;
  warnings?: string[];
}

export interface QuizSubmitResultDto {
  score: number;
  correctQ: number;
  totalQ: number;
  passed: boolean;
  passScore: number;
  results: {
    questionIndex: number;
    question: string;
    options: string[];
    selected: number;
    correct: number;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  contextSnapshot?: unknown;
  qualityReport?: QuizQualityReportDto;
}

export interface QuizHistoryDto {
  id: string;
  courseId: string;
  lessonId?: string;
  quizType: string;
  score: number;
  totalQ: number;
  correctQ?: number;
  submittedAt?: string;
  createdAt: string;
}

export interface CourseQuizStatusDto {
  bestScore: number;
  passed: boolean;
  attemptCount: number;
  passedAt?: string | null;
}

export async function createAiConversationAction(
  courseId: string,
  lessonId?: string,
  title?: string,
): Promise<ApiResponse<AiConversationDto>> {
  return callApi<AiConversationDto>(
    '/ai/api/chat/conversations',
    {
      method: 'POST',
      body: JSON.stringify({ courseId, lessonId, title }),
    },
    true,
  );
}

export async function listAiConversationsAction(
  courseId?: string,
  page = 1,
  limit = 20,
): Promise<ApiResponse<{ conversations: AiConversationDto[]; pagination: unknown }>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (courseId) params.set('courseId', courseId);

  return callApi<{ conversations: AiConversationDto[]; pagination: unknown }>(
    `/ai/api/chat/conversations?${params}`,
    { method: 'GET' },
    true,
  );
}

export async function getAiConversationAction(
  conversationId: string,
): Promise<ApiResponse<AiConversationDto & { messages: AiMessageDto[] }>> {
  return callApi<AiConversationDto & { messages: AiMessageDto[] }>(
    `/ai/api/chat/conversations/${conversationId}`,
    { method: 'GET' },
    true,
  );
}

export async function deleteAiConversationAction(
  conversationId: string,
): Promise<ApiResponse<null>> {
  return callApi<null>(
    `/ai/api/chat/conversations/${conversationId}`,
    { method: 'DELETE' },
    true,
  );
}

export async function getAiMessagesAction(
  conversationId: string,
  cursor?: string,
  limit = 50,
): Promise<ApiResponse<{ messages: AiMessageDto[]; nextCursor?: string; hasMore: boolean }>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  return callApi<{ messages: AiMessageDto[]; nextCursor?: string; hasMore: boolean }>(
    `/ai/api/chat/conversations/${conversationId}/messages?${params}`,
    { method: 'GET' },
    true,
  );
}

export async function generateQuizAction(
  courseId: string,
  lessonId?: string,
  quizType: 'LESSON' | 'FINAL_COURSE' = 'LESSON',
  questionCount = 5,
): Promise<ApiResponse<QuizSessionDto>> {
  return callApi<QuizSessionDto>(
    '/ai/api/quiz/generate',
    {
      method: 'POST',
      body: JSON.stringify({ courseId, lessonId, quizType, questionCount }),
    },
    true,
  );
}

export async function submitQuizAction(
  sessionId: string,
  answers: number[],
): Promise<ApiResponse<QuizSubmitResultDto>> {
  return callApi<QuizSubmitResultDto>(
    '/ai/api/quiz/submit',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, answers }),
    },
    true,
  );
}

export async function getQuizHistoryAction(
  courseId?: string,
): Promise<ApiResponse<{ history: QuizHistoryDto[] }>> {
  const params = courseId ? `?courseId=${courseId}` : '';
  return callApi<{ history: QuizHistoryDto[] }>(
    `/ai/api/quiz/history${params}`,
    { method: 'GET' },
    true,
  );
}

export async function getCourseQuizStatusAction(
  courseId: string,
): Promise<ApiResponse<CourseQuizStatusDto>> {
  return callApi<CourseQuizStatusDto>(
    `/ai/api/quiz/course/${courseId}/status`,
    { method: 'GET' },
    true,
  );
}

export async function getLessonQuizStatusAction(
  lessonId: string,
): Promise<ApiResponse<{
  id: string;
  score: number;
  totalQ: number;
  correctQ?: number;
  submittedAt?: string;
  quizType: string;
} | null>> {
  return callApi<{
    id: string;
    score: number;
    totalQ: number;
    correctQ?: number;
    submittedAt?: string;
    quizType: string;
  } | null>(
    `/ai/api/quiz/lesson/${lessonId}`,
    { method: 'GET' },
    true,
  );
}

export async function getAiContextStatusAction(
  lessonId: string,
): Promise<ApiResponse<AiContextStatusDto>> {
  return callApi<AiContextStatusDto>(
    `/ai/api/chat/ai-context/${lessonId}`,
    { method: 'GET' },
    true,
  );
}
