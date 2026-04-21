'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import {
  confirmLessonUploadAction,
  createChapterAction,
  createLessonAction,
  deleteChapterAction,
  deleteLessonAction,
  getCourseByIdAction,
  getCourseCategoriesAction,
  getCourseCurriculumAction,
  getCoursePublishGuardAction,
  publishCourseAction,
  registerYoutubeMediaAction,
  requestCourseThumbnailUploadAction,
  requestLessonUploadAction,
  updateChapterAction,
  updateCourseAction,
  updateLessonAction,
  type CourseCategoryDto,
  type CourseCurriculumDto,
  type CourseDto,
  type LessonDto,
  type PublishGuardDto,
} from '@/app/actions/instructor';

type WizardStep = 1 | 2 | 3 | 4 | 5;
type LevelValue = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type PricingMode = 'FREE' | 'PAID';
type StatusType = 'success' | 'error';

interface StepDefinition {
  id: WizardStep;
  title: string;
  subtitle: string;
}

interface FlatLesson {
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  lesson: LessonDto;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  { id: 1, title: 'Cơ bản', subtitle: 'Tiêu đề, danh mục, trình độ, ngôn ngữ' },
  { id: 2, title: 'Chi tiết', subtitle: 'Mô tả, ảnh bìa, giá khóa học' },
  { id: 3, title: 'Giáo trình', subtitle: 'Tạo chương và bài học' },
  { id: 4, title: 'Nội dung', subtitle: 'Media và mô tả cho từng bài học' },
  { id: 5, title: 'Publish', subtitle: 'Kiểm tra điều kiện trước khi mở bán' },
];

function parseStep(rawStep: string | null): WizardStep {
  const parsed = Number(rawStep || '1');
  if (parsed < 1) return 1;
  if (parsed > 5) return 5;
  return parsed as WizardStep;
}

function formatSavedAt(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function stripChapterPrefix(title: string): string {
  return title.replace(/^chương\s+\d+\s*:?\s*/i, '').trim();
}

export default function CourseWizardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const courseId = String(params.courseId);
  const currentStep = parseStep(searchParams.get('step'));

  const [loading, setLoading] = useState(true);
  const [savingStep, setSavingStep] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [uploadingLessonId, setUploadingLessonId] = useState('');
  const [savingLessonId, setSavingLessonId] = useState('');

  const [statusType, setStatusType] = useState<StatusType>('success');
  const [statusMessage, setStatusMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [curriculum, setCurriculum] = useState<CourseCurriculumDto | null>(null);
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [publishGuard, setPublishGuard] = useState<PublishGuardDto | null>(null);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState<LevelValue>('BEGINNER');
  const [language, setLanguage] = useState('vi');

  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [pricingMode, setPricingMode] = useState<PricingMode>('FREE');
  const [price, setPrice] = useState('0');

  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [editingChapterId, setEditingChapterId] = useState('');
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const [pendingDeleteChapterId, setPendingDeleteChapterId] = useState('');

  const [newLessonByChapter, setNewLessonByChapter] = useState<Record<string, string>>({});
  const [newLessonFreeByChapter, setNewLessonFreeByChapter] = useState<Record<string, boolean>>({});
  const [newLessonPriceByChapter, setNewLessonPriceByChapter] = useState<Record<string, string>>({});

  const [editingLessonId, setEditingLessonId] = useState('');
  const [editingLessonChapterId, setEditingLessonChapterId] = useState('');
  const [editingLessonTitle, setEditingLessonTitle] = useState('');
  const [editingLessonFree, setEditingLessonFree] = useState(true);
  const [editingLessonPrice, setEditingLessonPrice] = useState('');
  const [pendingDeleteLessonId, setPendingDeleteLessonId] = useState('');

  const [youtubeUrlByLesson, setYoutubeUrlByLesson] = useState<Record<string, string>>({});
  const [contentByLesson, setContentByLesson] = useState<Record<string, string>>({});

  const setStatus = (type: StatusType, message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  const flatLessons = useMemo(() => {
    if (!curriculum) return [] as FlatLesson[];

    return curriculum.chapters.flatMap((chapter, chapterIndex) =>
      chapter.lessons.map((lesson) => ({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterOrder: chapterIndex + 1,
        lesson,
      })),
    );
  }, [curriculum]);

  const saveLanguageToLocal = useCallback((value: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`course-wizard-language-${courseId}`, value);
  }, [courseId]);

  const loadLanguageFromLocal = useCallback((): string => {
    if (typeof window === 'undefined') return 'vi';
    return window.localStorage.getItem(`course-wizard-language-${courseId}`) || 'vi';
  }, [courseId]);

  const syncLessonDraftInputs = useCallback((nextCurriculum: CourseCurriculumDto) => {
    setYoutubeUrlByLesson((prev) => {
      const next: Record<string, string> = {};
      for (const chapter of nextCurriculum.chapters) {
        for (const lesson of chapter.lessons) {
          if (prev[lesson.id] !== undefined) {
            next[lesson.id] = prev[lesson.id];
          }
        }
      }
      return next;
    });

    setContentByLesson((prev) => {
      const next: Record<string, string> = {};
      for (const chapter of nextCurriculum.chapters) {
        for (const lesson of chapter.lessons) {
          if (prev[lesson.id] !== undefined) {
            next[lesson.id] = prev[lesson.id];
            continue;
          }
          next[lesson.id] = lesson.content || '';
        }
      }
      return next;
    });
  }, []);

  const loadWizardData = useCallback(async (withCategories = false) => {
    const requestList = [
      getCourseByIdAction(courseId),
      getCourseCurriculumAction(courseId),
      getCoursePublishGuardAction(courseId),
    ] as const;

    const [courseResult, curriculumResult, guardResult] = await Promise.all(requestList);

    if (!courseResult.success || !courseResult.data) {
      setStatus('error', courseResult.message || 'Không tải được khóa học.');
      setLoading(false);
      return;
    }

    if (!curriculumResult.success || !curriculumResult.data) {
      setStatus('error', curriculumResult.message || 'Không tải được giáo trình.');
      setLoading(false);
      return;
    }

    if (!guardResult.success || !guardResult.data) {
      setStatus('error', guardResult.message || 'Không tải được điều kiện publish.');
      setLoading(false);
      return;
    }

    setCourse(courseResult.data);
    setCurriculum(curriculumResult.data);
    setPublishGuard(guardResult.data);

    setTitle(courseResult.data.title || '');
    setCategoryId(courseResult.data.categoryId || '');
    setLevel(courseResult.data.level || 'BEGINNER');
    setDescription(courseResult.data.description || '');
    setThumbnail(courseResult.data.thumbnail || '');

    const currentPrice = Number(courseResult.data.price || 0);
    setPrice(String(currentPrice));
    setPricingMode(currentPrice > 0 ? 'PAID' : 'FREE');

    syncLessonDraftInputs(curriculumResult.data);

    if (withCategories) {
      const categoryResult = await getCourseCategoriesAction();
      if (categoryResult.success && categoryResult.data) {
        setCategories(categoryResult.data);
      }
    }

    setLoading(false);
  }, [courseId, syncLessonDraftInputs]);

  useEffect(() => {
    setLanguage(loadLanguageFromLocal());
    void loadWizardData(true);
  }, [loadWizardData, loadLanguageFromLocal]);

  const stepProgressPercent = useMemo(() => ((currentStep - 1) / 4) * 100, [currentStep]);

  const stepCompletion = useMemo(() => {
    const step1 = title.trim().length >= 3 && categoryId.trim().length > 0 && level.trim().length > 0 && language.trim().length > 0;
    const parsedPrice = Number(price);
    const step2 = description.trim().length >= 10 && thumbnail.trim().length > 0 && (pricingMode === 'FREE' || (Number.isFinite(parsedPrice) && parsedPrice > 0));
    const step3 = flatLessons.length > 0;
    const step4 = true;
    const step5 = Boolean(publishGuard?.hasAtLeastOneLesson && publishGuard.hasThumbnail && publishGuard.priceValidForPaidCourse && (course?.status || 'DRAFT') === 'PUBLISHED');

    return { step1, step2, step3, step4, step5 };
  }, [title, categoryId, level, language, description, thumbnail, pricingMode, price, flatLessons.length, publishGuard, course?.status]);

  const isStepUnlocked = useCallback((targetStep: WizardStep): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return stepCompletion.step1;
    if (targetStep === 3) return stepCompletion.step1 && stepCompletion.step2;
    if (targetStep === 4) return stepCompletion.step1 && stepCompletion.step2 && stepCompletion.step3;
    return stepCompletion.step1 && stepCompletion.step2 && stepCompletion.step3;
  }, [stepCompletion]);

  const saveStep1 = useCallback(async (): Promise<boolean> => {
    if (!course) return false;
    if (title.trim().length < 3) {
      setStatus('error', 'Tiêu đề cần ít nhất 3 ký tự.');
      return false;
    }
    if (!categoryId.trim()) {
      setStatus('error', 'Vui lòng chọn danh mục trước khi sang bước tiếp.');
      return false;
    }

    setSavingStep(true);
    const result = await updateCourseAction(course.id, {
      title: title.trim(),
      categoryId,
      level,
    });
    setSavingStep(false);

    if (!result.success || !result.data) {
      setStatus('error', result.message || 'Không thể lưu bước 1.');
      return false;
    }

    setCourse(result.data);
    saveLanguageToLocal(language);
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu nháp bước 1.');
    return true;
  }, [course, title, categoryId, level, language, saveLanguageToLocal]);

  const saveStep2 = useCallback(async (): Promise<boolean> => {
    if (!course) return false;

    const parsedPrice = Number(price);
    if (pricingMode === 'PAID' && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setStatus('error', 'Khóa học trả phí yêu cầu giá lớn hơn 0.');
      return false;
    }

    if (!thumbnail.trim()) {
      setStatus('error', 'Bước 2 bắt buộc phải có ảnh bìa.');
      return false;
    }

    setSavingStep(true);
    const result = await updateCourseAction(course.id, {
      description: description.trim(),
      thumbnail: thumbnail.trim(),
      price: pricingMode === 'PAID' ? parsedPrice : 0,
    });
    setSavingStep(false);

    if (!result.success || !result.data) {
      setStatus('error', result.message || 'Không thể lưu bước 2.');
      return false;
    }

    setCourse(result.data);
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu nháp bước 2.');
    await loadWizardData();
    return true;
  }, [course, price, pricingMode, thumbnail, description, loadWizardData]);

  const navigateStep = useCallback(async (nextStep: WizardStep) => {
    if (nextStep === currentStep) return;

    if (nextStep > currentStep) {
      if (currentStep === 1) {
        const ok = await saveStep1();
        if (!ok) return;
      }
      if (currentStep === 2) {
        const ok = await saveStep2();
        if (!ok) return;
      }

      if (!isStepUnlocked(nextStep)) {
        setStatus('error', 'Vui lòng hoàn tất các bước bắt buộc trước khi đi tiếp.');
        return;
      }
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('step', String(nextStep));
    router.replace(`/instructor/courses/${courseId}?${nextParams.toString()}`);

    if (nextStep === 5) {
      await loadWizardData();
    }
  }, [currentStep, saveStep1, saveStep2, isStepUnlocked, searchParams, router, courseId, loadWizardData]);

  const handleNext = async () => {
    const target = Math.min(5, currentStep + 1) as WizardStep;
    await navigateStep(target);
  };

  const handlePrevious = async () => {
    const target = Math.max(1, currentStep - 1) as WizardStep;
    await navigateStep(target);
  };

  const uploadWithPresigned = async (presignedUrl: string, file: File, uploadFields?: Record<string, string>) => {
    if (uploadFields) {
      const formData = new FormData();
      Object.entries(uploadFields).forEach(([key, value]) => formData.append(key, value));
      formData.append('file', file);

      const response = await fetch(presignedUrl, {
        method: 'POST',
        body: formData,
      });
      return response.ok;
    }

    if (presignedUrl.includes('/api/upload/local/')) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: formData,
      });
      return response.ok;
    }

    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    return response.ok;
  };

  const handleUploadThumbnail = async (file?: File | null) => {
    if (!file || !course) return;

    setIsUploadingThumbnail(true);

    try {
      const presigned = await requestCourseThumbnailUploadAction({
        filename: file.name,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
        courseId: course.id,
      });

      if (!presigned.success || !presigned.data) {
        setStatus('error', presigned.message || 'Không tạo được phiên upload ảnh bìa.');
        return;
      }

      const uploaded = await uploadWithPresigned(
        presigned.data.presignedUrl,
        file,
        presigned.data.uploadMethod === 'POST_FORM' ? presigned.data.uploadFields : undefined,
      );

      if (!uploaded) {
        setStatus('error', 'Upload ảnh bìa thất bại.');
        return;
      }

      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) {
        setStatus('error', confirmed.message || 'Không xác nhận được ảnh bìa.');
        return;
      }

      setThumbnail(confirmed.data.url);
      setStatus('success', 'Đã upload ảnh bìa. Hệ thống sẽ tự lưu ở bước này.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const buildNumberedChapterTitle = useCallback((chapterIndex: number, rawTitle: string): string => {
    const cleanTitle = stripChapterPrefix(rawTitle || '').trim();
    if (!cleanTitle) {
      return `Chương ${chapterIndex}`;
    }
    return `Chương ${chapterIndex}: ${cleanTitle}`;
  }, []);

  const handleCreateChapter = async () => {
    if (!course || !curriculum) return;

    const nextChapterIndex = curriculum.chapters.length + 1;
    const chapterTitle = buildNumberedChapterTitle(nextChapterIndex, newChapterTitle);

    const result = await createChapterAction(course.id, chapterTitle);
    if (!result.success) {
      setStatus('error', result.message || 'Không tạo được chương.');
      return;
    }

    setNewChapterTitle('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu bước 3 sau khi thêm chương.');
  };

  const handleRenameChapter = async (chapterId: string) => {
    if (!course || !curriculum) return;

    const chapterIndex = curriculum.chapters.findIndex((chapter) => chapter.id === chapterId) + 1;
    if (chapterIndex <= 0) {
      setStatus('error', 'Không tìm thấy chương cần cập nhật.');
      return;
    }

    const finalTitle = buildNumberedChapterTitle(chapterIndex, editingChapterTitle);

    const result = await updateChapterAction(course.id, chapterId, { title: finalTitle });
    if (!result.success) {
      setStatus('error', result.message || 'Không đổi tên được chương.');
      return;
    }

    setEditingChapterId('');
    setEditingChapterTitle('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu bước 3 sau khi đổi tên chương.');
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!course) return;

    const result = await deleteChapterAction(course.id, chapterId);
    if (!result.success) {
      setStatus('error', result.message || 'Không xóa được chương.');
      return;
    }

    setPendingDeleteChapterId('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu bước 3 sau khi xóa chương.');
  };

  const syncCoursePriceForPaidLesson = useCallback(async (lessonPriceText: string): Promise<boolean> => {
    if (!course) return false;

    const parsed = Number(lessonPriceText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStatus('error', 'Lesson trả phí bắt buộc nhập giá hợp lệ lớn hơn 0.');
      return false;
    }

    const courseUpdated = await updateCourseAction(course.id, {
      price: parsed,
    });

    if (!courseUpdated.success || !courseUpdated.data) {
      setStatus('error', courseUpdated.message || 'Không cập nhật được giá khóa học theo lesson trả phí.');
      return false;
    }

    setCourse(courseUpdated.data);
    setPricingMode('PAID');
    setPrice(String(parsed));
    return true;
  }, [course]);

  const handleCreateLesson = async (chapterId: string) => {
    if (!course) return;

    const nextTitle = (newLessonByChapter[chapterId] || '').trim();
    if (nextTitle.length < 2) {
      setStatus('error', 'Tên bài học cần ít nhất 2 ký tự.');
      return;
    }

    const isFree = newLessonFreeByChapter[chapterId] ?? true;
    const lessonPriceText = (newLessonPriceByChapter[chapterId] || '').trim();

    if (!isFree) {
      const okPrice = await syncCoursePriceForPaidLesson(lessonPriceText);
      if (!okPrice) return;
    }

    const result = await createLessonAction(course.id, chapterId, nextTitle, isFree);
    if (!result.success) {
      setStatus('error', result.message || 'Không tạo được bài học.');
      return;
    }

    setNewLessonByChapter((prev) => ({ ...prev, [chapterId]: '' }));
    setNewLessonFreeByChapter((prev) => ({ ...prev, [chapterId]: true }));
    setNewLessonPriceByChapter((prev) => ({ ...prev, [chapterId]: '' }));

    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu bước 3 sau khi thêm bài học.');
  };

  const startLessonEdit = (chapterId: string, lesson: LessonDto) => {
    setEditingLessonId(lesson.id);
    setEditingLessonChapterId(chapterId);
    setEditingLessonTitle(lesson.title);
    setEditingLessonFree(lesson.isFree);
    setEditingLessonPrice(course && Number(course.price) > 0 ? String(Number(course.price)) : '');
  };

  const handleSaveLessonEdit = async () => {
    if (!course || !editingLessonId || !editingLessonChapterId) return;

    if (editingLessonTitle.trim().length < 2) {
      setStatus('error', 'Tên bài học cần ít nhất 2 ký tự.');
      return;
    }

    if (!editingLessonFree) {
      const okPrice = await syncCoursePriceForPaidLesson(editingLessonPrice);
      if (!okPrice) return;
    }

    const result = await updateLessonAction(course.id, editingLessonChapterId, editingLessonId, {
      title: editingLessonTitle.trim(),
      isFree: editingLessonFree,
    });

    if (!result.success) {
      setStatus('error', result.message || 'Không chỉnh sửa được bài học.');
      return;
    }

    setEditingLessonId('');
    setEditingLessonChapterId('');
    setEditingLessonTitle('');
    setEditingLessonPrice('');
    setEditingLessonFree(true);

    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu bước 3 sau khi chỉnh sửa bài học.');
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!course) return;

    const result = await deleteLessonAction(course.id, chapterId, lessonId);
    if (!result.success) {
      setStatus('error', result.message || 'Không xóa được bài học.');
      return;
    }

    setPendingDeleteLessonId('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu bước 3 sau khi xóa bài học.');
  };

  const handleUploadLessonVideo = async (payload: FlatLesson, file?: File | null) => {
    if (!file || !course) return;

    setUploadingLessonId(payload.lesson.id);

    try {
      const presigned = await requestLessonUploadAction({
        filename: file.name,
        mimeType: file.type || 'video/mp4',
        size: file.size,
        courseId: course.id,
        lessonId: payload.lesson.id,
      });

      if (!presigned.success || !presigned.data) {
        setStatus('error', presigned.message || 'Không tạo được phiên upload video.');
        return;
      }

      const uploaded = await uploadWithPresigned(
        presigned.data.presignedUrl,
        file,
        presigned.data.uploadMethod === 'POST_FORM' ? presigned.data.uploadFields : undefined,
      );

      if (!uploaded) {
        setStatus('error', 'Upload video thất bại.');
        return;
      }

      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) {
        setStatus('error', confirmed.message || 'Không xác nhận được video.');
        return;
      }

      const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, {
        videoUrl: confirmed.data.url,
        sourceType: 'UPLOAD',
      });

      if (!updated.success) {
        setStatus('error', updated.message || 'Không cập nhật được lesson sau upload.');
        return;
      }

      await loadWizardData();
      setLastSavedAt(new Date());
      setStatus('success', `Đã cập nhật media cho bài "${payload.lesson.title}".`);
    } finally {
      setUploadingLessonId('');
    }
  };

  const handleAttachYoutube = async (payload: FlatLesson) => {
    if (!course) return;

    const youtubeUrl = (youtubeUrlByLesson[payload.lesson.id] || '').trim();
    if (!youtubeUrl) {
      setStatus('error', 'Vui lòng nhập URL YouTube trước khi lưu.');
      return;
    }

    setSavingLessonId(payload.lesson.id);

    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, {
      sourceType: 'YOUTUBE',
      videoUrl: youtubeUrl,
    });

    if (!updated.success) {
      setSavingLessonId('');
      setStatus('error', updated.message || 'Không cập nhật được bài học YouTube.');
      return;
    }

    await registerYoutubeMediaAction({
      title: payload.lesson.title,
      youtubeUrl,
      courseId: course.id,
      lessonId: payload.lesson.id,
    });

    await loadWizardData();
    setSavingLessonId('');
    setLastSavedAt(new Date());
    setStatus('success', `Đã gắn YouTube cho bài "${payload.lesson.title}".`);
  };

  const handleClearLessonMedia = async (payload: FlatLesson) => {
    if (!course) return;

    setSavingLessonId(payload.lesson.id);
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, {
      sourceType: 'UPLOAD',
      videoUrl: null,
    });

    if (!updated.success) {
      setSavingLessonId('');
      setStatus('error', updated.message || 'Không thể bỏ media của bài học.');
      return;
    }

    await loadWizardData();
    setSavingLessonId('');
    setLastSavedAt(new Date());
    setStatus('success', `Bài "${payload.lesson.title}" đang ở dạng chỉ có nội dung văn bản.`);
  };

  const handleSaveLessonContent = async (payload: FlatLesson) => {
    if (!course) return;

    const rawContent = contentByLesson[payload.lesson.id] ?? payload.lesson.content ?? '';
    const nextContent = rawContent.trim();

    setSavingLessonId(payload.lesson.id);

    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, {
      content: nextContent.length > 0 ? nextContent : null,
    });

    setSavingLessonId('');

    if (!updated.success) {
      setStatus('error', updated.message || 'Không lưu được mô tả bài học.');
      return;
    }

    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', `Đã lưu mô tả cho bài "${payload.lesson.title}".`);
  };

  const handlePublish = async () => {
    if (!course) return;

    const step2Saved = await saveStep2();
    if (!step2Saved) return;

    setPublishing(true);
    const result = await publishCourseAction(course.id, thumbnail.trim() || undefined);
    setPublishing(false);

    if (!result.success) {
      setStatus('error', result.message || 'Không thể publish khóa học.');
      await loadWizardData();
      return;
    }

    const publicSlug = result.data?.slug || course.slug;
    if (publicSlug) {
      router.push(`/courses/${publicSlug}`);
      return;
    }

    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Publish thành công nhưng thiếu slug để chuyển trang công khai.');
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Đang tải dữ liệu wizard...</div>;
  }

  if (!course || !curriculum || !publishGuard) {
    return <div className="p-8 text-muted-foreground">Không tìm thấy khóa học.</div>;
  }

  const canPublish = publishGuard.hasAtLeastOneLesson && publishGuard.hasThumbnail && publishGuard.priceValidForPaidCourse;

  return (
    <div className="space-y-6 p-8">
      <Link href="/instructor/courses" className="flex w-fit items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Course Wizard - 5 bước</h1>
        <p className="text-sm text-muted-foreground">Bước {currentStep}/5. Hệ thống tự lưu sau mỗi thao tác quan trọng.</p>
        <div className="h-2 w-full rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${stepProgressPercent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {STEP_DEFINITIONS.map((stepDef) => {
          const stepDone =
            (stepDef.id === 1 && stepCompletion.step1) ||
            (stepDef.id === 2 && stepCompletion.step2) ||
            (stepDef.id === 3 && stepCompletion.step3) ||
            (stepDef.id === 4 && stepCompletion.step4) ||
            (stepDef.id === 5 && stepCompletion.step5);

          return (
            <button
              key={stepDef.id}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${currentStep === stepDef.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              onClick={() => {
                void navigateStep(stepDef.id);
              }}
              type="button"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{stepDef.id}. {stepDef.title}</p>
                {stepDone ? <Check className="h-4 w-4 text-emerald-600" /> : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">{stepDef.subtitle}</p>
            </button>
          );
        })}
      </div>

      {statusMessage ? <StatusMessage type={statusType} message={statusMessage} /> : null}

      <div className="text-xs text-slate-500">
        {savingStep ? 'Đang lưu nháp...' : lastSavedAt ? `Đã lưu lúc ${formatSavedAt(lastSavedAt)}` : 'Chưa có bản lưu nháp'}
      </div>

      {currentStep === 1 ? (
        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle>Bước 1 - Thông tin cơ bản</CardTitle>
            <CardDescription>Bắt buộc tiêu đề, danh mục, trình độ và ngôn ngữ để chuyển bước.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Tiêu đề khóa học</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tiêu đề khóa học" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Danh mục</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Trình độ</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={level}
                  onChange={(event) => setLevel(event.target.value as LevelValue)}
                >
                  <option value="BEGINNER">BEGINNER</option>
                  <option value="INTERMEDIATE">INTERMEDIATE</option>
                  <option value="ADVANCED">ADVANCED</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Ngôn ngữ</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={language}
                  onChange={(event) => {
                    setLanguage(event.target.value);
                    saveLanguageToLocal(event.target.value);
                  }}
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void saveStep1()} disabled={savingStep}>Lưu nháp bước 1</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 2 ? (
        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle>Bước 2 - Mô tả + ảnh bìa + giá</CardTitle>
            <CardDescription>Bước này bắt buộc để mở nút publish ở bước cuối.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Mô tả</label>
              <textarea
                className="min-h-28 w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Nhập mô tả khóa học"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold">Ảnh bìa</label>
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                {thumbnail ? (
                  <img src={thumbnail} alt="thumbnail" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex items-center text-sm font-semibold text-slate-500">
                    <ImageIcon className="mr-2 h-4 w-4" /> Chưa có ảnh bìa
                  </div>
                )}
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-600">
                <UploadCloud className="mr-2 h-4 w-4" /> {isUploadingThumbnail ? 'Đang upload...' : 'Upload ảnh bìa'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploadingThumbnail}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void handleUploadThumbnail(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold">Định giá</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={pricingMode === 'FREE' ? 'default' : 'outline'}
                  onClick={() => {
                    setPricingMode('FREE');
                    setPrice('0');
                  }}
                >
                  Khóa học miễn phí
                </Button>
                <Button
                  type="button"
                  variant={pricingMode === 'PAID' ? 'default' : 'outline'}
                  onClick={() => setPricingMode('PAID')}
                >
                  Khóa học trả phí
                </Button>
              </div>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={pricingMode === 'FREE'}
                placeholder="Giá (VND)"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void saveStep2()} disabled={savingStep || isUploadingThumbnail}>Lưu nháp bước 2</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 3 ? (
        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle>Bước 3 - Xây dựng giáo trình</CardTitle>
            <CardDescription>Tạo chương, tạo bài học, chỉnh sửa nhanh và ràng buộc giá cho lesson trả phí.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
              <Input
                value={newChapterTitle}
                onChange={(event) => setNewChapterTitle(event.target.value)}
                placeholder="Nhập tiêu đề chương (hệ thống tự đánh số Chương 1, 2, 3...)"
              />
              <Button onClick={handleCreateChapter}>Thêm chương</Button>
            </div>

            {curriculum.chapters.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có chương nào.</p>
            ) : (
              <div className="space-y-4">
                {curriculum.chapters.map((chapter, chapterIndex) => (
                  <Card key={chapter.id} className="border border-slate-200 shadow-none">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center justify-between gap-2">
                        {editingChapterId === chapter.id ? (
                          <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                            <Input value={editingChapterTitle} onChange={(event) => setEditingChapterTitle(event.target.value)} placeholder="Tiêu đề chương" />
                            <Button size="sm" onClick={() => void handleRenameChapter(chapter.id)}>Lưu</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingChapterId('');
                                setEditingChapterTitle('');
                              }}
                            >
                              Hủy
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="font-bold text-slate-800">Chương {chapterIndex + 1}: {stripChapterPrefix(chapter.title)}</p>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingChapterId(chapter.id);
                                  setEditingChapterTitle(stripChapterPrefix(chapter.title));
                                  setPendingDeleteChapterId('');
                                }}
                              >
                                Đổi tên
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPendingDeleteChapterId((prev) => (prev === chapter.id ? '' : chapter.id));
                                }}
                              >
                                Xóa
                              </Button>
                            </div>
                          </>
                        )}
                      </div>

                      {pendingDeleteChapterId === chapter.id ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                          <p className="font-medium text-red-700">Xác nhận xóa chương này và toàn bộ bài học bên trong?</p>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => void handleDeleteChapter(chapter.id)}>Xác nhận xóa</Button>
                            <Button size="sm" variant="outline" onClick={() => setPendingDeleteChapterId('')}>Hủy</Button>
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {chapter.lessons.length === 0 ? (
                          <p className="text-xs text-slate-500">Chương này chưa có bài học.</p>
                        ) : (
                          chapter.lessons.map((lesson, lessonIndex) => (
                            <div key={lesson.id} className="space-y-3 rounded-md border border-slate-200 p-3">
                              {editingLessonId === lesson.id ? (
                                <div className="space-y-3">
                                  <Input value={editingLessonTitle} onChange={(event) => setEditingLessonTitle(event.target.value)} placeholder="Tên bài học" />
                                  <label className="inline-flex items-center rounded-md border border-slate-200 px-3 py-2 text-sm">
                                    <input
                                      type="checkbox"
                                      className="mr-2"
                                      checked={editingLessonFree}
                                      onChange={(event) => setEditingLessonFree(event.target.checked)}
                                    />
                                    Bài học miễn phí
                                  </label>
                                  {!editingLessonFree ? (
                                    <Input
                                      type="number"
                                      min={0}
                                      value={editingLessonPrice}
                                      onChange={(event) => setEditingLessonPrice(event.target.value)}
                                      placeholder="Giá yêu cầu cho lesson trả phí (VND)"
                                    />
                                  ) : null}
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => void handleSaveLessonEdit()}>Lưu</Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingLessonId('');
                                        setEditingLessonChapterId('');
                                        setEditingLessonTitle('');
                                        setEditingLessonFree(true);
                                        setEditingLessonPrice('');
                                      }}
                                    >
                                      Hủy
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">Bài {lessonIndex + 1}: {lesson.title}</p>
                                      <p className="text-xs text-slate-500">
                                        {lesson.isFree ? 'Miễn phí' : 'Trả phí'} • {lesson.videoUrl ? 'Đã có media' : 'Chưa có media'}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          startLessonEdit(chapter.id, lesson);
                                          setPendingDeleteLessonId('');
                                        }}
                                      >
                                        Chỉnh sửa
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setPendingDeleteLessonId((prev) => (prev === lesson.id ? '' : lesson.id));
                                        }}
                                      >
                                        Xóa
                                      </Button>
                                    </div>
                                  </div>

                                  {pendingDeleteLessonId === lesson.id ? (
                                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                                      <p className="font-medium text-red-700">Xác nhận xóa bài học này?</p>
                                      <div className="mt-2 flex gap-2">
                                        <Button size="sm" variant="destructive" onClick={() => void handleDeleteLesson(chapter.id, lesson.id)}>Xác nhận xóa</Button>
                                        <Button size="sm" variant="outline" onClick={() => setPendingDeleteLessonId('')}>Hủy</Button>
                                      </div>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                        <Input
                          value={newLessonByChapter[chapter.id] || ''}
                          onChange={(event) => setNewLessonByChapter((prev) => ({ ...prev, [chapter.id]: event.target.value }))}
                          placeholder="Tên bài học mới"
                        />
                        <label className="inline-flex items-center rounded-md border border-slate-200 px-3 text-sm">
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={Boolean(newLessonFreeByChapter[chapter.id] ?? true)}
                            onChange={(event) => setNewLessonFreeByChapter((prev) => ({ ...prev, [chapter.id]: event.target.checked }))}
                          />
                          Miễn phí
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={newLessonPriceByChapter[chapter.id] || ''}
                          onChange={(event) => setNewLessonPriceByChapter((prev) => ({ ...prev, [chapter.id]: event.target.value }))}
                          disabled={Boolean(newLessonFreeByChapter[chapter.id] ?? true)}
                          placeholder="Giá nếu lesson trả phí"
                        />
                        <Button onClick={() => void handleCreateLesson(chapter.id)}>Thêm bài học</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 4 ? (
        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle>Bước 4 - Nội dung bài học</CardTitle>
            <CardDescription>Hiển thị toàn bộ bài học theo tất cả chương để nhập đồng thời media và mô tả.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {curriculum.chapters.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có chương để nhập nội dung.</p>
            ) : (
              <div className="space-y-4">
                {curriculum.chapters.map((chapter, chapterIndex) => (
                  <div key={chapter.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-800">Chương {chapterIndex + 1}: {stripChapterPrefix(chapter.title)}</p>

                    {chapter.lessons.length === 0 ? (
                      <p className="text-sm text-slate-500">Chương này chưa có bài học.</p>
                    ) : (
                      <div className="space-y-3">
                        {chapter.lessons.map((lesson, lessonIndex) => {
                          const flatPayload = flatLessons.find((item) => item.lesson.id === lesson.id && item.chapterId === chapter.id);
                          if (!flatPayload) return null;

                          const youtubeInput = youtubeUrlByLesson[lesson.id] ?? '';
                          const contentInput = contentByLesson[lesson.id] ?? lesson.content ?? '';

                          return (
                            <div key={lesson.id} className="space-y-3 rounded-md border border-slate-200 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">Bài {lessonIndex + 1}: {lesson.title}</p>
                                  <p className="text-xs text-slate-500">
                                    Trạng thái media: {lesson.videoUrl ? (lesson.sourceType === 'YOUTUBE' ? 'YouTube' : 'Upload') : 'Chỉ nội dung văn bản'}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-500">{lesson.isFree ? 'Miễn phí' : 'Trả phí'}</p>
                              </div>

                              <div className="rounded-md border border-slate-200 p-3 text-xs text-slate-600">
                                Mỗi lesson chỉ lưu 1 loại media tại một thời điểm: upload video hoặc link YouTube. Bạn có thể bỏ media để lesson chỉ còn nội dung văn bản.
                              </div>

                              <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_auto]">
                                <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-600">
                                  <UploadCloud className="mr-2 h-4 w-4" /> {uploadingLessonId === lesson.id ? 'Đang upload...' : 'Upload video'}
                                  <input
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                                    className="hidden"
                                    disabled={uploadingLessonId === lesson.id || savingLessonId === lesson.id}
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      void handleUploadLessonVideo(flatPayload, file);
                                      event.currentTarget.value = '';
                                    }}
                                  />
                                </label>
                                <Input
                                  value={youtubeInput}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setYoutubeUrlByLesson((prev) => ({ ...prev, [lesson.id]: value }));
                                  }}
                                  placeholder="https://www.youtube.com/watch?v=..."
                                />
                                <Button
                                  variant="outline"
                                  onClick={() => void handleAttachYoutube(flatPayload)}
                                  disabled={savingLessonId === lesson.id || uploadingLessonId === lesson.id}
                                >
                                  Lưu YouTube
                                </Button>
                              </div>

                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => void handleClearLessonMedia(flatPayload)}
                                  disabled={savingLessonId === lesson.id || uploadingLessonId === lesson.id}
                                >
                                  Bỏ media (chỉ text)
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-semibold">Mô tả bài học</label>
                                <textarea
                                  className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
                                  value={contentInput}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setContentByLesson((prev) => ({ ...prev, [lesson.id]: value }));
                                  }}
                                  placeholder="Nhập nội dung/mô tả của bài học (có thể chỉ text, không cần media)"
                                />
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => void handleSaveLessonContent(flatPayload)}
                                    disabled={savingLessonId === lesson.id || uploadingLessonId === lesson.id}
                                  >
                                    Lưu mô tả
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-md border border-slate-200 p-3 text-sm">
              <p className="font-semibold">Tổng quan media</p>
              <p className="text-slate-500">
                Đã gắn media: {flatLessons.filter((item) => Boolean(item.lesson.videoUrl)).length}/{flatLessons.length} bài học
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 5 ? (
        <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
          <CardHeader>
            <CardTitle>Bước 5 - Điều kiện publish</CardTitle>
            <CardDescription>Nút publish chỉ mở khi tất cả điều kiện bắt buộc đã đạt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold">Có ít nhất 1 bài học</p>
                <p className={`text-sm ${publishGuard.hasAtLeastOneLesson ? 'text-emerald-700' : 'text-red-600'}`}>
                  {publishGuard.hasAtLeastOneLesson ? 'Đạt' : 'Chưa đạt'}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold">Ảnh bìa đã upload</p>
                <p className={`text-sm ${publishGuard.hasThumbnail ? 'text-emerald-700' : 'text-red-600'}`}>
                  {publishGuard.hasThumbnail ? 'Đạt' : 'Chưa đạt'}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
                <p className="text-sm font-semibold">Giá hợp lệ khi có bài học trả phí</p>
                <p className={`text-sm ${publishGuard.priceValidForPaidCourse ? 'text-emerald-700' : 'text-red-600'}`}>
                  {publishGuard.priceValidForPaidCourse ? 'Đạt' : 'Chưa đạt'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Số bài trả phí: {publishGuard.paidLessonCount} • Tổng số bài: {publishGuard.lessonCount}</p>
              </div>
            </div>

            <Button onClick={() => void handlePublish()} disabled={!canPublish || publishing} className="w-full">
              {publishing ? 'Đang publish...' : canPublish ? 'Publish khóa học' : 'Chưa đủ điều kiện publish'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => void handlePrevious()} disabled={currentStep === 1}>Bước trước</Button>
        <Button onClick={() => void handleNext()} disabled={currentStep === 5}>
          Bước tiếp <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
