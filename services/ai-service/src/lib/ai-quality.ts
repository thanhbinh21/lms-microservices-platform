import type { CourseContextForAI, LessonAiContext } from './course-client.js';

export type ContextQuality = 'HIGH' | 'MEDIUM' | 'LOW';
export type QuizSkill = 'recall' | 'understanding' | 'application';

export interface ContextCoverageReport {
  totalLessons: number;
  lessonsWithUsableContext: number;
  coveragePercent: number;
  averageContextChars: number;
  quality: ContextQuality;
  missingFields: string[];
  sources: string[];
}

export interface ContextPack {
  courseId: string;
  courseTitle: string;
  lessonId?: string;
  lessonTitle?: string;
  coverage: ContextCoverageReport;
  lessonSummaries: {
    lessonId: string;
    chapterTitle: string;
    lessonTitle: string;
    contextChars: number;
    sources: string[];
  }[];
}

export interface QuizBlueprintItem {
  index: number;
  skill: QuizSkill;
  focus: string;
  chapterTitle?: string;
  lessonTitle?: string;
}

export interface QuizBlueprint {
  quizType: 'LESSON' | 'FINAL_COURSE';
  questionCount: number;
  items: QuizBlueprintItem[];
}

export interface QuizQuestionLike {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizQualityReport {
  expectedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  optionIssueCount: number;
  genericCount: number;
  answerDistribution: Record<string, number>;
  warnings: string[];
}

type LessonWithChapter = CourseContextForAI['curriculum'][number]['lessons'][number] & {
  chapterTitle: string;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForCompare(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAllLessons(course: CourseContextForAI): LessonWithChapter[] {
  return course.curriculum.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      ...lesson,
      chapterTitle: chapter.title,
    })),
  );
}

function getLessonContextText(
  lesson: LessonWithChapter,
  lessonContext?: LessonAiContext | null,
): string {
  return [
    lesson.title,
    lesson.chapterTitle,
    lesson.content || '',
    lessonContext?.textContent || '',
  ].map(normalizeText).filter(Boolean).join('\n');
}

function getLessonSources(lesson: LessonWithChapter, lessonContext?: LessonAiContext | null): string[] {
  const sources = new Set<string>(['LESSON_METADATA']);
  if (lesson.content?.trim()) sources.add('LESSON_CONTENT');
  for (const source of lessonContext?.sources || []) sources.add(source);
  if (lessonContext?.sourceType) sources.add(lessonContext.sourceType);
  return Array.from(sources);
}

export function buildContextPack(
  course: CourseContextForAI,
  lessonContexts: Record<string, LessonAiContext | null | undefined> = {},
  activeLessonId?: string,
): ContextPack {
  const lessons = getAllLessons(course);
  const missingFields: string[] = [];
  const sources = new Set<string>(['COURSE_METADATA', 'LESSON_METADATA']);
  const summaries: ContextPack['lessonSummaries'] = [];
  let usableCount = 0;
  let totalChars = 0;

  if (!course.description?.trim() || course.description.trim().length < 60) {
    missingFields.push('COURSE_DESCRIPTION_SHORT');
  }
  if (!course.category?.trim()) missingFields.push('COURSE_CATEGORY');
  if (!course.level?.trim()) missingFields.push('COURSE_LEVEL');
  if (lessons.length === 0) missingFields.push('PUBLISHED_LESSONS');

  for (const lesson of lessons) {
    const lessonContext = lessonContexts[lesson.id];
    const text = getLessonContextText(lesson, lessonContext);
    const chars = text.length;
    totalChars += chars;
    if (lesson.content?.trim()) sources.add('LESSON_CONTENT');
    for (const source of lessonContext?.sources || []) sources.add(source);
    if (lessonContext?.sourceType) sources.add(lessonContext.sourceType);

    const hasUsableContext = chars >= 120 || Boolean(lesson.content?.trim() && lesson.content.trim().length >= 60);
    if (hasUsableContext) usableCount++;

    summaries.push({
      lessonId: lesson.id,
      chapterTitle: lesson.chapterTitle,
      lessonTitle: lesson.title,
      contextChars: chars,
      sources: getLessonSources(lesson, lessonContext),
    });
  }

  const coveragePercent = lessons.length > 0 ? Math.round((usableCount / lessons.length) * 100) : 0;
  const averageContextChars = lessons.length > 0 ? Math.round(totalChars / lessons.length) : 0;
  const quality: ContextQuality = coveragePercent >= 80 && averageContextChars >= 240
    ? 'HIGH'
    : coveragePercent >= 50 && averageContextChars >= 120
      ? 'MEDIUM'
      : 'LOW';

  if (quality === 'LOW') missingFields.push('LESSON_CONTEXT_DEPTH');
  if (usableCount < lessons.length) missingFields.push('SOME_LESSONS_THIN_CONTEXT');

  const activeLesson = activeLessonId ? lessons.find((lesson) => lesson.id === activeLessonId) : undefined;

  return {
    courseId: course.id,
    courseTitle: course.title,
    lessonId: activeLesson?.id,
    lessonTitle: activeLesson?.title,
    coverage: {
      totalLessons: lessons.length,
      lessonsWithUsableContext: usableCount,
      coveragePercent,
      averageContextChars,
      quality,
      missingFields: Array.from(new Set(missingFields)),
      sources: Array.from(sources),
    },
    lessonSummaries: summaries,
  };
}

export function hasMinimumFinalQuizContext(pack: ContextPack): boolean {
  if (pack.coverage.totalLessons === 0) return false;
  const minimumLessons = pack.coverage.totalLessons <= 2
    ? pack.coverage.totalLessons
    : Math.max(3, Math.ceil(pack.coverage.totalLessons * 0.6));

  return pack.coverage.lessonsWithUsableContext >= minimumLessons
    && pack.coverage.averageContextChars >= 100;
}

export function hasMinimumLessonQuizContext(pack: ContextPack, lessonId: string): boolean {
  const summary = pack.lessonSummaries.find((item) => item.lessonId === lessonId);
  if (!summary) return false;
  return summary.contextChars >= 120 || pack.coverage.averageContextChars >= 140;
}

export function buildQuizBlueprint(
  course: CourseContextForAI,
  quizType: 'LESSON' | 'FINAL_COURSE',
  questionCount: number,
  lessonId?: string,
): QuizBlueprint {
  const skills: QuizSkill[] = ['recall', 'understanding', 'application'];
  const lessons = getAllLessons(course);
  const targetLessons = quizType === 'LESSON' && lessonId
    ? lessons.filter((lesson) => lesson.id === lessonId)
    : lessons;
  const fallbackFocus = normalizeText(course.title) || 'Nội dung khóa học';

  const items = Array.from({ length: questionCount }, (_, index) => {
    const lesson = targetLessons[index % Math.max(1, targetLessons.length)];
    return {
      index: index + 1,
      skill: skills[index % skills.length],
      focus: normalizeText(lesson?.content || lesson?.title || fallbackFocus).slice(0, 180) || fallbackFocus,
      chapterTitle: lesson?.chapterTitle,
      lessonTitle: lesson?.title,
    };
  });

  return { quizType, questionCount, items };
}

export function formatBlueprintForPrompt(blueprint: QuizBlueprint): string {
  return blueprint.items
    .map((item) => {
      const scope = [item.chapterTitle, item.lessonTitle].filter(Boolean).join(' / ');
      return `${item.index}. ${item.skill}${scope ? ` | ${scope}` : ''} | ${item.focus}`;
    })
    .join('\n');
}

export function formatContextQualityForPrompt(pack: ContextPack): string {
  return [
    `Quality: ${pack.coverage.quality}`,
    `Coverage: ${pack.coverage.lessonsWithUsableContext}/${pack.coverage.totalLessons} lessons (${pack.coverage.coveragePercent}%)`,
    `Average context length: ${pack.coverage.averageContextChars} chars`,
    pack.coverage.missingFields.length > 0 ? `Missing: ${pack.coverage.missingFields.join(', ')}` : 'Missing: none',
    `Sources: ${pack.coverage.sources.join(', ')}`,
  ].join('\n');
}

function isGenericQuestion(question: string): boolean {
  const normalized = normalizeForCompare(question);
  if (normalized.length < 25) return true;
  const genericPatterns = [
    /khai niem .* nen duoc hieu nhu the nao/,
    /noi dung nao sau day la dung/,
    /dieu nao sau day dung/,
    /muc dich chinh la gi/,
  ];
  return genericPatterns.some((pattern) => pattern.test(normalized));
}

function hasOptionIssues(question: QuizQuestionLike): boolean {
  if (!Array.isArray(question.options) || question.options.length !== 4) return true;
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) return true;

  const normalizedOptions = question.options.map(normalizeForCompare);
  if (normalizedOptions.some((option) => option.length < 2)) return true;
  return new Set(normalizedOptions).size !== 4;
}

function questionSignature(question: QuizQuestionLike): string {
  return normalizeForCompare(question.question);
}

function optionSetSignature(question: QuizQuestionLike): string {
  return question.options.map(normalizeForCompare).sort().join('|');
}

function selectBalancedQuestions(questions: QuizQuestionLike[], expectedCount: number): QuizQuestionLike[] {
  const maxPerAnswer = Math.max(2, Math.ceil(expectedCount / 3));
  const selected: QuizQuestionLike[] = [];
  const answerCounts = new Map<number, number>();

  for (const question of questions) {
    const count = answerCounts.get(question.correctIndex) || 0;
    if (count >= maxPerAnswer) continue;
    selected.push(question);
    answerCounts.set(question.correctIndex, count + 1);
    if (selected.length >= expectedCount) return selected;
  }

  for (const question of questions) {
    if (selected.includes(question)) continue;
    selected.push(question);
    if (selected.length >= expectedCount) break;
  }

  return selected;
}

export function evaluateAndSelectQuizQuestions(
  questions: QuizQuestionLike[],
  expectedCount: number,
): { accepted: QuizQuestionLike[]; report: QuizQualityReport } {
  const seenQuestions = new Set<string>();
  const seenOptionSets = new Set<string>();
  const validQuestions: QuizQuestionLike[] = [];
  let duplicateCount = 0;
  let optionIssueCount = 0;
  let genericCount = 0;

  for (const question of questions) {
    const qSig = questionSignature(question);
    const oSig = optionSetSignature(question);

    if (seenQuestions.has(qSig) || seenOptionSets.has(oSig)) {
      duplicateCount++;
      continue;
    }
    seenQuestions.add(qSig);
    seenOptionSets.add(oSig);

    if (hasOptionIssues(question)) {
      optionIssueCount++;
      continue;
    }
    if (isGenericQuestion(question.question)) {
      genericCount++;
      continue;
    }

    validQuestions.push(question);
  }

  const accepted = selectBalancedQuestions(validQuestions, expectedCount);
  const answerDistribution: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0 };
  for (const question of accepted) {
    answerDistribution[String(question.correctIndex)] += 1;
  }

  const warnings: string[] = [];
  if (accepted.length < expectedCount) warnings.push('NOT_ENOUGH_QUALITY_QUESTIONS');
  if (duplicateCount > 0) warnings.push('DUPLICATE_QUESTIONS_REMOVED');
  if (optionIssueCount > 0) warnings.push('OPTION_SET_ISSUES_REMOVED');
  if (genericCount > 0) warnings.push('GENERIC_QUESTIONS_REMOVED');
  if (Math.max(...Object.values(answerDistribution)) > Math.ceil(expectedCount * 0.5)) {
    warnings.push('ANSWER_DISTRIBUTION_SKEWED');
  }

  return {
    accepted,
    report: {
      expectedCount,
      acceptedCount: accepted.length,
      rejectedCount: Math.max(0, questions.length - accepted.length),
      duplicateCount,
      optionIssueCount,
      genericCount,
      answerDistribution,
      warnings,
    },
  };
}

export function buildLexicalSearchSnippets(course: CourseContextForAI, query: string, limit = 4): string[] {
  const queryTokens = new Set(
    normalizeForCompare(query)
      .split(' ')
      .filter((token) => token.length >= 3),
  );
  if (queryTokens.size === 0) return [];

  const scored = getAllLessons(course).map((lesson) => {
    const text = normalizeText([lesson.chapterTitle, lesson.title, lesson.content || ''].join(' '));
    const normalized = normalizeForCompare(text);
    let score = 0;
    for (const token of queryTokens) {
      if (normalized.includes(token)) score++;
    }
    return { lesson, text, score };
  }).filter((item) => item.score > 0);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => `${item.lesson.chapterTitle} / ${item.lesson.title}: ${item.text.slice(0, 240)}`);
}
