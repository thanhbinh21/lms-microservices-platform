'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Check, ChevronRight, Image as ImageIcon, UploadCloud,
  Plus, Pencil, Trash2, Award, X, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, BookOpen, Eye, EyeOff, Save,
} from 'lucide-react';
import { FocusTrap } from 'focus-trap-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import {
  confirmLessonUploadAction,
  createCourseCategoryAction,
  createChapterAction,
  createLessonAction,
  deleteChapterAction,
  deleteLessonAction,
  getCourseByIdAction,
  getCourseCategoriesAction,
  getCourseCurriculumAction,
  getCoursePublishGuardAction,
  getInstructorCertificateTemplatesAction,
  publishCourseAction,
  registerYoutubeMediaAction,
  requestCourseThumbnailUploadAction,
  requestLessonUploadAction,
  updateChapterAction,
  updateCourseCertificateTemplatesAction,
  getCourseCertificateTemplatesAction,
  updateCourseAction,
  updateLessonAction,
  createInstructorCertificateTemplateAction,
  deleteInstructorCertificateTemplateAction,
  type CourseDto,
  type CourseCurriculumDto,
  type CourseCategoryDto,
  type CertificateTemplateDto,
  type LessonDto,
  type PublishGuardDto,
} from '@/app/actions/instructor';

type WizardStep = 1 | 2 | 3 | 4 | 5;
type LevelValue = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type PricingMode = 'FREE' | 'PAID';

interface StepDefinition {
  id: WizardStep;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

interface FlatLesson {
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  lesson: LessonDto;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  { id: 1, title: 'Co ban', subtitle: 'Tieu de, danh muc, thong tin khoa hoc', icon: <BookOpen className="size-4" /> },
  { id: 2, title: 'Chi tiáº¿t', subtitle: 'MÃ´ táº£, áº£nh bÃ¬a, giÃ¡, chá»©ng chá»‰', icon: <Eye className="size-4" /> },
  { id: 3, title: 'GiÃ¡o trÃ¬nh', subtitle: 'ChÆ°Æ¡ng vÃ  bÃ i há»c', icon: <BookOpen className="size-4" /> },
  { id: 4, title: 'Ná»™i dung', subtitle: 'Video, YouTube, mÃ´ táº£', icon: <UploadCloud className="size-4" /> },
  { id: 5, title: 'Xuáº¥t báº£n', subtitle: 'Kiá»ƒm tra vÃ  cÃ´ng khai', icon: <Check className="size-4" /> },
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
  return title.replace(/^chÆ°Æ¡ng\s+\d+\s*:?\s*/i, '').trim();
}

interface CreateCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (category: CourseCategoryDto) => void;
}

function CreateCategoryModal({ open, onClose, onSuccess }: CreateCategoryModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
    }
  }, [open]);

  const handleCreate = async () => {
    if (name.trim().length < 2) {
      setError('Ten danh muc can it nhat 2 ky tu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createCourseCategoryAction({ name: name.trim() });
      if (result.success && result.data) {
        onSuccess(result.data);
        onClose();
      } else {
        setError(result.message || 'Khong the tao danh muc.');
      }
    } catch {
      setError('Da co loi he thong.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="presentation">
      <FocusTrap>
        <div role="dialog" aria-modal="true" aria-labelledby="modal-cat-title" className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 id="modal-cat-title" className="text-lg font-bold">Tao danh muc moi</h3>
            <button onClick={onClose} aria-label="Dong" className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="cat-name" className="mb-1.5 block text-sm font-semibold">Ten danh muc</label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Lap trinh Web, Marketing..." onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }} autoFocus />
            </div>
            {error && <StatusMessage type="error" message={error} />}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">Huy</Button>
              <Button onClick={() => void handleCreate()} disabled={loading} className="rounded-xl font-bold">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Tao danh muc
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

// Inline Certificate Template Creation Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface CreateCertificateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (template: CertificateTemplateDto) => void;
}

function CreateCertificateModal({ open, onClose, onSuccess }: CreateCertificateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setDescription(''); setError(''); }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError('TÃªn máº«u chá»©ng chá»‰ cáº§n Ã­t nháº¥t 2 kÃ½ tá»±.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createInstructorCertificateTemplateAction({ name: name.trim(), description: description.trim() || undefined });
      if (result.success && result.data) {
        onSuccess(result.data);
        onClose();
      } else {
        setError(result.message || 'KhÃ´ng thá»ƒ táº¡o máº«u chá»©ng chá»‰.');
      }
    } catch {
      setError('ÄÃ£ cÃ³ lá»—i há»‡ thá»‘ng.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="presentation">
      <FocusTrap>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cert-title"
          className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 id="modal-cert-title" className="text-lg font-bold">Táº¡o máº«u chá»©ng chá»‰ má»›i</h3>
            <button onClick={onClose} aria-label="ÄÃ³ng" className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="cert-tmpl-name" className="mb-1.5 block text-sm font-semibold">TÃªn máº«u chá»©ng chá»‰</label>
              <Input id="cert-tmpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Chá»©ng nháº­n hoÃ n thÃ nh khÃ³a há»c" onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }} autoFocus />
            </div>
            <div>
              <label htmlFor="cert-tmpl-desc" className="mb-1.5 block text-sm font-semibold">MÃ´ táº£ (tÃ¹y chá»n)</label>
              <textarea id="cert-tmpl-desc" className="min-h-20 w-full rounded-md border border-slate-200 bg-white p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="MÃ´ táº£ vá» chá»©ng chá»‰ nÃ y..." />
            </div>
            {error && <StatusMessage type="error" message={error} />}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">Há»§y</Button>
              <Button onClick={() => void handleCreate()} disabled={loading} className="rounded-xl font-bold">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Táº¡o máº«u chá»©ng chá»‰
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [curriculum, setCurriculum] = useState<CourseCurriculumDto | null>(null);
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [certificateTemplates, setCertificateTemplates] = useState<CertificateTemplateDto[]>([]);
  const [publishGuard, setPublishGuard] = useState<PublishGuardDto | null>(null);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // Step 1 state
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState<LevelValue>('BEGINNER');
  const [language, setLanguage] = useState('vi');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Step 2 state
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [pricingMode, setPricingMode] = useState<PricingMode>('FREE');
  const [price, setPrice] = useState('0');

  // Step 3 state
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

  // Step 4 state
  const [youtubeUrlByLesson, setYoutubeUrlByLesson] = useState<Record<string, string>>({});
  const [contentByLesson, setContentByLesson] = useState<Record<string, string>>({});

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);

  const setStatus = (type: 'success' | 'error', message: string) => {
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

  const syncLessonDraftInputs = useCallback((nextCurriculum: CourseCurriculumDto) => {
    setYoutubeUrlByLesson((prev) => {
      const next: Record<string, string> = {};
      for (const chapter of nextCurriculum.chapters) {
        for (const lesson of chapter.lessons) {
          if (prev[lesson.id] !== undefined) next[lesson.id] = prev[lesson.id];
        }
      }
      return next;
    });
    setContentByLesson((prev) => {
      const next: Record<string, string> = {};
      for (const chapter of nextCurriculum.chapters) {
        for (const lesson of chapter.lessons) {
          next[lesson.id] = prev[lesson.id] ?? lesson.content ?? '';
        }
      }
      return next;
    });
  }, []);

  const loadWizardData = useCallback(async (withExtras = false) => {
    const [courseResult, curriculumResult, guardResult] = await Promise.all([
      getCourseByIdAction(courseId),
      getCourseCurriculumAction(courseId),
      getCoursePublishGuardAction(courseId),
    ]);

    if (!courseResult.success || !courseResult.data) {
      setStatus('error', courseResult.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c khÃ³a há»c.');
      setLoading(false);
      return;
    }
    if (!curriculumResult.success || !curriculumResult.data) {
      setStatus('error', curriculumResult.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c giÃ¡o trÃ¬nh.');
      setLoading(false);
      return;
    }
    if (!guardResult.success || !guardResult.data) {
      setStatus('error', guardResult.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c Ä‘iá»u kiá»‡n publish.');
      setLoading(false);
      return;
    }

    const c = courseResult.data;
    setCourse(c);
    setCurriculum(curriculumResult.data);
    setPublishGuard(guardResult.data);

    setTitle(c.title || '');
    setCategoryId(c.categoryId || '');
    setLevel((c.level as LevelValue) || 'BEGINNER');
    setDescription(c.description || '');
    setThumbnail(c.thumbnail || '');
    const currentPrice = Number(c.price || 0);
    setPrice(String(currentPrice));
    setPricingMode(currentPrice > 0 ? 'PAID' : 'FREE');

    syncLessonDraftInputs(curriculumResult.data);

    if (withExtras) {
      const [catResult, templateResult, courseTemplatesResult] = await Promise.all([
        getCourseCategoriesAction(),
        getInstructorCertificateTemplatesAction(),
        getCourseCertificateTemplatesAction(courseId),
      ]);

      if (catResult.success && catResult.data) setCategories(catResult.data);
      if (templateResult.success && templateResult.data) setCertificateTemplates(templateResult.data);
      if (courseTemplatesResult.success && courseTemplatesResult.data) {
        setSelectedTemplateIds(courseTemplatesResult.data);
      }
    }

    setLoading(false);
  }, [courseId, syncLessonDraftInputs]);

  useEffect(() => {
    const savedLang = window.localStorage.getItem(`course-wizard-language-${courseId}`) || 'vi';
    setLanguage(savedLang);
    void loadWizardData(true);
  }, [loadWizardData, courseId]);

  const stepProgressPercent = useMemo(() => ((currentStep - 1) / 4) * 100, [currentStep]);

  const stepCompletion = useMemo(() => {
    const step1 = title.trim().length >= 3 && categoryId.trim().length > 0;
    const parsedPrice = Number(price);
    const step2 = description.trim().length >= 10 && thumbnail.trim().length > 0
      && (pricingMode === 'FREE' || (Number.isFinite(parsedPrice) && parsedPrice > 0));
    const step3 = flatLessons.length > 0;
    const step4 = true;
    const step5 = Boolean(
      publishGuard?.hasAtLeastOneLesson && publishGuard.hasThumbnail
      && publishGuard.priceValidForPaidCourse && (course?.status || 'DRAFT') === 'PUBLISHED',
    );
    return { step1, step2, step3, step4, step5 };
  }, [title, categoryId, description, thumbnail, pricingMode, price, flatLessons.length, publishGuard, course?.status]);

  const isStepUnlocked = useCallback((targetStep: WizardStep): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return stepCompletion.step1;
    if (targetStep === 3) return stepCompletion.step1 && stepCompletion.step2;
    if (targetStep === 4) return stepCompletion.step1 && stepCompletion.step2 && stepCompletion.step3;
    return stepCompletion.step1 && stepCompletion.step2 && stepCompletion.step3;
  }, [stepCompletion]);

  // â”€â”€â”€ Save Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const saveStep1 = useCallback(async (): Promise<boolean> => {
    if (!course) return false;
    if (title.trim().length < 3) { setStatus('error', 'TiÃªu Ä‘á» cáº§n Ã­t nháº¥t 3 kÃ½ tá»±.'); return false; }
    if (!categoryId.trim()) { setStatus('error', 'Vui lÃ²ng chá»n danh má»¥c.'); return false; }

    setSavingStep(true);
    const result = await updateCourseAction(course.id, { title: title.trim(), categoryId, level });
    setSavingStep(false);

    if (!result.success || !result.data) {
      setStatus('error', result.message || 'KhÃ´ng thá»ƒ lÆ°u bÆ°á»›c 1.');
      return false;
    }

    setCourse(result.data);
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ lÆ°u thÃ´ng tin cÆ¡ báº£n.');
    return true;
  }, [course, title, categoryId, level]);


  const saveTemplateSelection = useCallback(async (): Promise<boolean> => {
    if (!course) return true;
    setSavingTemplates(true);
    const result = await updateCourseCertificateTemplatesAction(course.id, selectedTemplateIds);
    setSavingTemplates(false);
    if (!result.success) {
      setStatus('error', result.message || 'KhÃ´ng lÆ°u Ä‘Æ°á»£c chá»©ng chá»‰.');
      return false;
    }
    return true;
  }, [course, selectedTemplateIds]);

  const saveStep2 = useCallback(async (): Promise<boolean> => {
    if (!course) return false;
    const parsedPrice = Number(price);
    if (pricingMode === 'PAID' && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setStatus('error', 'KhÃ³a há»c tráº£ phÃ­ yÃªu cáº§u giÃ¡ lá»›n hÆ¡n 0.');
      return false;
    }
    if (!thumbnail.trim()) {
      setStatus('error', 'Báº¯t buá»™c pháº£i cÃ³ áº£nh bÃ¬a.');
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
      setStatus('error', result.message || 'KhÃ´ng thá»ƒ lÆ°u bÆ°á»›c 2.');
      return false;
    }

    setCourse(result.data);
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ lÆ°u chi tiáº¿t khÃ³a há»c.');
    await loadWizardData();
    return true;
  }, [course, price, pricingMode, thumbnail, description, loadWizardData]);

  const handleSaveStep1 = async () => {
    const ok = await saveStep1();
    if (ok) await saveTemplateSelection();
  };

  const navigateStep = useCallback(async (nextStep: WizardStep) => {
    if (nextStep === currentStep) return;

    if (nextStep > currentStep) {
      if (currentStep === 1) {
        const ok = await saveStep1();
        if (!ok) return;
        await saveTemplateSelection();
      }
      if (currentStep === 2) {
        const ok = await saveStep2();
        if (!ok) return;
      }
      if (!isStepUnlocked(nextStep)) {
        setStatus('error', 'Vui lÃ²ng hoÃ n táº¥t cÃ¡c bÆ°á»›c báº¯t buá»™c trÆ°á»›c khi Ä‘i tiáº¿p.');
        return;
      }
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('step', String(nextStep));
    router.replace(`/instructor/courses/${courseId}?${nextParams.toString()}`);
    if (nextStep === 5) await loadWizardData();
  }, [currentStep, saveStep1, saveStep2, isStepUnlocked, searchParams, router, courseId, loadWizardData, saveTemplateSelection]);

  const handleNext = async () => {
    const target = Math.min(5, currentStep + 1) as WizardStep;
    await navigateStep(target);
  };

  const handlePrevious = async () => {
    const target = Math.max(1, currentStep - 1) as WizardStep;
    await navigateStep(target);
  };

  // â”€â”€â”€ Upload helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const uploadWithPresigned = async (presignedUrl: string, file: File, uploadFields?: Record<string, string>) => {
    if (uploadFields) {
      const formData = new FormData();
      Object.entries(uploadFields).forEach(([key, value]) => formData.append(key, value));
      formData.append('file', file);
      const response = await fetch(presignedUrl, { method: 'POST', body: formData });
      return response.ok;
    }
    if (presignedUrl.includes('/api/upload/local/')) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(presignedUrl, { method: 'PUT', body: formData });
      return response.ok;
    }
    const response = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    return response.ok;
  };

  const handleUploadThumbnail = async (file?: File | null) => {
    if (!file || !course) return;
    setIsUploadingThumbnail(true);
    try {
      const presigned = await requestCourseThumbnailUploadAction({ filename: file.name, mimeType: file.type || 'image/jpeg', size: file.size, courseId: course.id });
      if (!presigned.success || !presigned.data) { setStatus('error', presigned.message || 'KhÃ´ng táº¡o Ä‘Æ°á»£c phiÃªn upload áº£nh bÃ¬a.'); return; }
      const uploaded = await uploadWithPresigned(presigned.data.presignedUrl, file, presigned.data.uploadMethod === 'POST_FORM' ? presigned.data.uploadFields : undefined);
      if (!uploaded) { setStatus('error', 'Upload áº£nh bÃ¬a tháº¥t báº¡i.'); return; }
      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) { setStatus('error', confirmed.message || 'KhÃ´ng xÃ¡c nháº­n Ä‘Æ°á»£c áº£nh bÃ¬a.'); return; }
      const nextThumbnail = confirmed.data.url;
      setThumbnail(nextThumbnail);
      setLastSavedAt(new Date());
      setStatus('success', 'áº¢nh bÃ¬a Ä‘Ã£ Ä‘Æ°á»£c upload vÃ  lÆ°u.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const buildNumberedChapterTitle = useCallback((chapterIndex: number, rawTitle: string): string => {
    const cleanTitle = stripChapterPrefix(rawTitle || '').trim();
    if (!cleanTitle) return `ChÆ°Æ¡ng ${chapterIndex}`;
    return `ChÆ°Æ¡ng ${chapterIndex}: ${cleanTitle}`;
  }, []);

  // â”€â”€â”€ Curriculum handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCreateChapter = async () => {
    if (!course || !curriculum) return;
    const nextChapterIndex = curriculum.chapters.length + 1;
    const chapterTitle = buildNumberedChapterTitle(nextChapterIndex, newChapterTitle);
    const result = await createChapterAction(course.id, chapterTitle);
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng táº¡o Ä‘Æ°á»£c chÆ°Æ¡ng.'); return; }
    setNewChapterTitle('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ thÃªm chÆ°Æ¡ng má»›i.');
  };

  const handleRenameChapter = async (chapterId: string) => {
    if (!course || !curriculum) return;
    const chapterIndex = curriculum.chapters.findIndex((ch) => ch.id === chapterId) + 1;
    if (chapterIndex <= 0) { setStatus('error', 'KhÃ´ng tÃ¬m tháº¥y chÆ°Æ¡ng cáº§n cáº­p nháº­t.'); return; }
    const finalTitle = buildNumberedChapterTitle(chapterIndex, editingChapterTitle);
    const result = await updateChapterAction(course.id, chapterId, { title: finalTitle });
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng Ä‘á»•i tÃªn Ä‘Æ°á»£c chÆ°Æ¡ng.'); return; }
    setEditingChapterId('');
    setEditingChapterTitle('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ Ä‘á»•i tÃªn chÆ°Æ¡ng.');
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!course) return;
    const result = await deleteChapterAction(course.id, chapterId);
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng xÃ³a Ä‘Æ°á»£c chÆ°Æ¡ng.'); return; }
    setPendingDeleteChapterId('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ xÃ³a chÆ°Æ¡ng.');
  };

  const syncCoursePriceForPaidLesson = useCallback(async (lessonPriceText: string): Promise<boolean> => {
    if (!course) return false;
    const parsed = Number(lessonPriceText);
    if (!Number.isFinite(parsed) || parsed <= 0) { setStatus('error', 'Lesson tráº£ phÃ­ báº¯t buá»™c nháº­p giÃ¡ há»£p lá»‡.'); return false; }
    const courseUpdated = await updateCourseAction(course.id, { price: parsed });
    if (!courseUpdated.success || !courseUpdated.data) { setStatus('error', courseUpdated.message || 'KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c giÃ¡.'); return false; }
    setCourse(courseUpdated.data);
    setPricingMode('PAID');
    setPrice(String(parsed));
    return true;
  }, [course]);

  const handleCreateLesson = async (chapterId: string) => {
    if (!course) return;
    const nextTitle = (newLessonByChapter[chapterId] || '').trim();
    if (nextTitle.length < 2) { setStatus('error', 'TÃªn bÃ i há»c cáº§n Ã­t nháº¥t 2 kÃ½ tá»±.'); return; }
    const isFree = newLessonFreeByChapter[chapterId] ?? true;
    const lessonPriceText = (newLessonPriceByChapter[chapterId] || '').trim();
    if (!isFree) { const okPrice = await syncCoursePriceForPaidLesson(lessonPriceText); if (!okPrice) return; }
    const result = await createLessonAction(course.id, chapterId, nextTitle, isFree);
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng táº¡o Ä‘Æ°á»£c bÃ i há»c.'); return; }
    setNewLessonByChapter((prev) => ({ ...prev, [chapterId]: '' }));
    setNewLessonFreeByChapter((prev) => ({ ...prev, [chapterId]: true }));
    setNewLessonPriceByChapter((prev) => ({ ...prev, [chapterId]: '' }));
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ thÃªm bÃ i há»c má»›i.');
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
    if (editingLessonTitle.trim().length < 2) { setStatus('error', 'TÃªn bÃ i há»c cáº§n Ã­t nháº¥t 2 kÃ½ tá»±.'); return; }
    if (!editingLessonFree) { const okPrice = await syncCoursePriceForPaidLesson(editingLessonPrice); if (!okPrice) return; }
    const result = await updateLessonAction(course.id, editingLessonChapterId, editingLessonId, { title: editingLessonTitle.trim(), isFree: editingLessonFree });
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng chá»‰nh sá»­a Ä‘Æ°á»£c bÃ i há»c.'); return; }
    setEditingLessonId(''); setEditingLessonChapterId(''); setEditingLessonTitle(''); setEditingLessonPrice(''); setEditingLessonFree(true);
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ cáº­p nháº­t bÃ i há»c.');
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!course) return;
    const result = await deleteLessonAction(course.id, chapterId, lessonId);
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng xÃ³a Ä‘Æ°á»£c bÃ i há»c.'); return; }
    setPendingDeleteLessonId('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'ÄÃ£ xÃ³a bÃ i há»c.');
  };

  const handleUploadLessonVideo = async (payload: FlatLesson, file?: File | null) => {
    if (!file || !course) return;
    setUploadingLessonId(payload.lesson.id);
    try {
      const presigned = await requestLessonUploadAction({ filename: file.name, mimeType: file.type || 'video/mp4', size: file.size, courseId: course.id, lessonId: payload.lesson.id });
      if (!presigned.success || !presigned.data) { setStatus('error', presigned.message || 'KhÃ´ng táº¡o Ä‘Æ°á»£c phiÃªn upload.'); return; }
      const uploaded = await uploadWithPresigned(presigned.data.presignedUrl, file, presigned.data.uploadMethod === 'POST_FORM' ? presigned.data.uploadFields : undefined);
      if (!uploaded) { setStatus('error', 'Upload video tháº¥t báº¡i.'); return; }
      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) { setStatus('error', confirmed.message || 'KhÃ´ng xÃ¡c nháº­n Ä‘Æ°á»£c video.'); return; }
      const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { videoUrl: confirmed.data.url, sourceType: 'UPLOAD' });
      if (!updated.success) { setStatus('error', updated.message || 'KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c lesson.'); return; }
      await loadWizardData();
      setLastSavedAt(new Date());
      setStatus('success', `ÄÃ£ upload video cho "${payload.lesson.title}".`);
    } finally {
      setUploadingLessonId('');
    }
  };

  const handleAttachYoutube = async (payload: FlatLesson) => {
    if (!course) return;
    const youtubeUrl = (youtubeUrlByLesson[payload.lesson.id] || '').trim();
    if (!youtubeUrl) { setStatus('error', 'Vui lÃ²ng nháº­p URL YouTube.'); return; }
    setSavingLessonId(payload.lesson.id);
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { sourceType: 'YOUTUBE', videoUrl: youtubeUrl });
    if (!updated.success) { setSavingLessonId(''); setStatus('error', updated.message || 'KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c.'); return; }
    await registerYoutubeMediaAction({ title: payload.lesson.title, youtubeUrl, courseId: course.id, lessonId: payload.lesson.id });
    await loadWizardData();
    setSavingLessonId('');
    setLastSavedAt(new Date());
    setStatus('success', `ÄÃ£ gáº¯n YouTube cho "${payload.lesson.title}".`);
  };

  const handleClearLessonMedia = async (payload: FlatLesson) => {
    if (!course) return;
    setSavingLessonId(payload.lesson.id);
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { sourceType: 'UPLOAD', videoUrl: null });
    if (!updated.success) { setSavingLessonId(''); setStatus('error', updated.message || 'KhÃ´ng thá»ƒ bá» media.'); return; }
    await loadWizardData();
    setSavingLessonId('');
    setLastSavedAt(new Date());
    setStatus('success', `BÃ i "${payload.lesson.title}" Ä‘ang á»Ÿ dáº¡ng chá»‰ cÃ³ ná»™i dung vÄƒn báº£n.`);
  };

  const handleSaveLessonContent = async (payload: FlatLesson) => {
    if (!course) return;
    const rawContent = contentByLesson[payload.lesson.id] ?? payload.lesson.content ?? '';
    const nextContent = rawContent.trim();
    setSavingLessonId(payload.lesson.id);
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { content: nextContent.length > 0 ? nextContent : null });
    setSavingLessonId('');
    if (!updated.success) { setStatus('error', updated.message || 'KhÃ´ng lÆ°u Ä‘Æ°á»£c mÃ´ táº£.'); return; }
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', `ÄÃ£ lÆ°u mÃ´ táº£ cho "${payload.lesson.title}".`);
  };

  const handlePublish = async () => {
    if (!course) return;
    const step2Saved = await saveStep2();
    if (!step2Saved) return;
    setPublishing(true);
    const result = await publishCourseAction(course.id, thumbnail.trim() || undefined);
    setPublishing(false);
    if (!result.success) { setStatus('error', result.message || 'KhÃ´ng thá»ƒ publish.'); await loadWizardData(); return; }
    const publicSlug = result.data?.slug || course.slug;
    if (publicSlug) { router.push(`/courses/${publicSlug}`); return; }
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Publish thÃ nh cÃ´ng.');
  };

  // â”€â”€â”€ Category/Cert handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCategoryCreated = (category: CourseCategoryDto) => {
    setCategories((prev) => [...prev, category]);
    setCategoryId(category.id);
  };


  const handleCertCreated = (template: CertificateTemplateDto) => {
    setCertificateTemplates((prev) => [...prev, template]);
    setSelectedTemplateIds((prev) => [...prev, template.id]);
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId],
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto size-8 animate-spin" /></div>;
  }

  if (!course || !curriculum || !publishGuard) {
    return <div className="p-8 text-muted-foreground">KhÃ´ng tÃ¬m tháº¥y khÃ³a há»c.</div>;
  }

  const canPublish = publishGuard.hasAtLeastOneLesson && publishGuard.hasThumbnail && publishGuard.priceValidForPaidCourse;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* â”€â”€â”€ Header â”€â”€â”€ */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-6xl px-8 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/instructor/courses" className="flex items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="mr-1.5 size-4" /> Quay láº¡i
              </Link>
              <div className="h-5 w-px bg-slate-200" />
              <h1 className="text-xl font-bold tracking-tight">{course.title || 'KhÃ³a há»c má»›i'}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {course.status || 'DRAFT'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {savingStep ? (
                <span className="flex items-center gap-1.5 text-amber-600"><Loader2 className="size-3.5 animate-spin" /> Äang lÆ°u...</span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> LÆ°u lÃºc {formatSavedAt(lastSavedAt)}</span>
              ) : (
                <span className="flex items-center gap-1.5"><AlertCircle className="size-3.5 text-slate-400" /> ChÆ°a lÆ°u</span>
              )}
            </div>
          </div>

          {/* Step tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STEP_DEFINITIONS.map((stepDef) => {
              const stepDone =
                (stepDef.id === 1 && stepCompletion.step1) ||
                (stepDef.id === 2 && stepCompletion.step2) ||
                (stepDef.id === 3 && stepCompletion.step3) ||
                (stepDef.id === 4 && stepCompletion.step4) ||
                (stepDef.id === 5 && stepCompletion.step5);
              const isActive = currentStep === stepDef.id;
              const isUnlocked = isStepUnlocked(stepDef.id);

              return (
                <button
                  key={stepDef.id}
                  onClick={() => { if (isUnlocked) void navigateStep(stepDef.id); }}
                  disabled={!isUnlocked}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-md'
                      : isUnlocked
                      ? 'bg-white text-slate-700 border border-slate-200 hover:border-primary/40 hover:bg-primary/5'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : stepDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {stepDone && !isActive ? <Check className="size-3" /> : stepDef.id}
                  </span>
                  <span className="hidden sm:inline">{stepDef.title}</span>
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${stepProgressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* â”€â”€â”€ Content â”€â”€â”€ */}
      <div className="mx-auto max-w-6xl px-8 py-6">
        {statusMessage && (
          <div className="mb-4"><StatusMessage type={statusType} message={statusMessage} /></div>
        )}

        {/* â”€â”€ STEP 1: Basic â”€â”€ */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  ThÃ´ng tin cÆ¡ báº£n
                </CardTitle>
                <CardDescription>TiÃªu Ä‘á», danh má»¥c, trÃ¬nh Ä‘á»™ vÃ  ngÃ´n ngá»¯ lÃ  báº¯t buá»™c Ä‘á»ƒ tiáº¿p tá»¥c.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">TiÃªu Ä‘á» khÃ³a há»c</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: React.js Thá»±c chiáº¿n Doanh nghiá»‡p" className="h-12 rounded-xl text-base" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 flex items-center justify-between text-sm font-semibold">
                      Danh má»¥c
                      <button onClick={() => setShowCategoryModal(true)} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <Plus className="size-3" /> Táº¡o má»›i
                      </button>
                    </label>
                    <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="">Chá»n danh má»¥c</option>
                      {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">TrÃ¬nh Ä‘á»™</label>
                    <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={level} onChange={(e) => setLevel(e.target.value as LevelValue)}>
                      <option value="BEGINNER">NgÆ°á»i má»›i báº¯t Ä‘áº§u</option>
                      <option value="INTERMEDIATE">Trung cáº¥p</option>
                      <option value="ADVANCED">NÃ¢ng cao</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">NgÃ´n ngá»¯</label>
                    <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={language} onChange={(e) => { setLanguage(e.target.value); window.localStorage.setItem(`course-wizard-language-${courseId}`, e.target.value); }}>
                      <option value="vi">Tiáº¿ng Viá»‡t</option>
                      <option value="en">English</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => void handleSaveStep1()} disabled={savingStep || savingTemplates} className="rounded-xl font-bold gap-2 shadow-md">
                    {savingStep ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    LÆ°u thÃ´ng tin cÆ¡ báº£n
                  </Button>
                </div>
              </CardContent>
            </Card>
            {/* Navigation */}
            <div className="flex justify-end">
              <Button onClick={() => void handleNext()} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiáº¿p tá»¥c <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP 2: Details â”€â”€ */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="size-5 text-primary" />
                  Chi tiáº¿t khÃ³a há»c
                </CardTitle>
                <CardDescription>MÃ´ táº£, áº£nh bÃ¬a vÃ  Ä‘á»‹nh giÃ¡ lÃ  báº¯t buá»™c Ä‘á»ƒ cÃ³ thá»ƒ xuáº¥t báº£n.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">MÃ´ táº£ khÃ³a há»c</label>
                  <textarea className="min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nháº­p mÃ´ táº£ chi tiáº¿t vá» khÃ³a há»c..." />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold">áº¢nh bÃ¬a</label>
                  <div className="flex aspect-video max-w-sm items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    {thumbnail ? (
                      <Image src={thumbnail} alt="thumbnail" width={640} height={360} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-sm font-semibold text-slate-500">
                        <ImageIcon className="mb-2 size-10 text-slate-300" />
                        ChÆ°a cÃ³ áº£nh bÃ¬a
                      </div>
                    )}
                  </div>
                  <label className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors">
                    <UploadCloud className="mr-2 size-4" />
                    {isUploadingThumbnail ? 'Äang upload...' : 'Upload áº£nh bÃ¬a'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={isUploadingThumbnail}
                      onChange={(event) => { const file = event.target.files?.[0]; void handleUploadThumbnail(file); event.currentTarget.value = ''; }} />
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Äá»‹nh giÃ¡</label>
                  <div className="flex gap-3 mb-3">
                    <Button type="button" variant={pricingMode === 'FREE' ? 'default' : 'outline'} onClick={() => { setPricingMode('FREE'); setPrice('0'); }} className="rounded-xl font-semibold gap-1.5">
                      Miá»…n phÃ­
                    </Button>
                    <Button type="button" variant={pricingMode === 'PAID' ? 'default' : 'outline'} onClick={() => setPricingMode('PAID')} className="rounded-xl font-semibold gap-1.5">
                      Tráº£ phÃ­
                    </Button>
                  </div>
                  <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} disabled={pricingMode === 'FREE'}
                    placeholder="GiÃ¡ (VND)" className="max-w-xs rounded-xl h-12 text-base" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => void saveStep2()} disabled={savingStep || isUploadingThumbnail} className="rounded-xl font-bold gap-2 shadow-md">
                    {savingStep ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    LÆ°u chi tiáº¿t
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Certificate selection */}
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-5 text-primary" />
                  Chá»©ng chá»‰ cho khÃ³a há»c
                </CardTitle>
                <CardDescription>Chá»n máº«u chá»©ng chá»‰ mÃ  há»c viÃªn sáº½ nháº­n Ä‘Æ°á»£c khi hoÃ n thÃ nh khÃ³a há»c.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex flex-wrap gap-2 flex-1">
                    {certificateTemplates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 w-full">
                        <Award className="mb-1.5 size-4 text-slate-400" />
                        Báº¡n chÆ°a cÃ³ máº«u chá»©ng chá»‰ nÃ o. Táº¡o máº«u má»›i táº¡i tab Chá»©ng chá»‰ hoáº·c báº¥m nÃºt bÃªn dÆ°á»›i.
                      </div>
                    ) : (
                      certificateTemplates.map((template) => (
                        <button key={template.id}
                          onClick={() => toggleTemplate(template.id)}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                            selectedTemplateIds.includes(template.id)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                          }`}
                        >
                          {selectedTemplateIds.includes(template.id) ? <Check className="size-4" /> : <Award className="size-4" />}
                          {template.name}
                        </button>
                      ))
                    )}
                  </div>
                  <Button variant="outline" onClick={() => setShowCertModal(true)} className="rounded-xl font-semibold gap-1.5 h-12 shrink-0">
                    <Plus className="size-4" /> Táº¡o máº«u má»›i
                  </Button>
                  <Button onClick={() => void saveTemplateSelection()} disabled={savingTemplates} className="rounded-xl font-bold gap-1.5 h-12 shrink-0">
                    {savingTemplates ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    LÆ°u
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay láº¡i
              </Button>
              <Button onClick={() => void handleNext()} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiáº¿p tá»¥c <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP 3: Curriculum â”€â”€ */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  XÃ¢y dá»±ng giÃ¡o trÃ¬nh
                </CardTitle>
                <CardDescription>Táº¡o chÆ°Æ¡ng vÃ  bÃ i há»c. Há»‡ thá»‘ng tá»± Ä‘Ã¡nh sá»‘ chÆ°Æ¡ng.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <Input value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="TÃªn chÆ°Æ¡ng (há»‡ thá»‘ng tá»± Ä‘Ã¡nh sá»‘ ChÆ°Æ¡ng 1, 2...)"
                    className="h-12 rounded-xl text-base" onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateChapter(); }} />
                  <Button onClick={() => void handleCreateChapter()} className="h-12 rounded-xl font-bold gap-1.5 shadow-md" disabled={!newChapterTitle.trim()}>
                    <Plus className="size-4" /> ThÃªm chÆ°Æ¡ng
                  </Button>
                </div>

                {curriculum.chapters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
                    <BookOpen className="mx-auto mb-3 size-10 text-slate-300" />
                    <p className="font-semibold">ChÆ°a cÃ³ chÆ°Æ¡ng nÃ o</p>
                    <p className="text-sm mt-1">Báº¯t Ä‘áº§u báº±ng cÃ¡ch thÃªm chÆ°Æ¡ng Ä‘áº§u tiÃªn á»Ÿ trÃªn.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {curriculum.chapters.map((chapter, chapterIndex) => (
                      <div key={chapter.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {/* Chapter header */}
                        <div className="flex items-center justify-between gap-3 bg-slate-50 px-5 py-4 border-b border-slate-200">
                          {editingChapterId === chapter.id ? (
                            <div className="flex flex-1 items-center gap-2">
                              <Input value={editingChapterTitle} onChange={(e) => setEditingChapterTitle(e.target.value)}
                                className="h-9 rounded-lg text-sm flex-1" onKeyDown={(e) => { if (e.key === 'Enter') void handleRenameChapter(chapter.id); }} autoFocus />
                              <Button size="sm" onClick={() => void handleRenameChapter(chapter.id)} className="rounded-lg font-bold h-9">LÆ°u</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingChapterId(''); setEditingChapterTitle(''); }} className="rounded-lg h-9">Há»§y</Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{chapterIndex + 1}</span>
                                <div>
                                  <p className="font-bold text-slate-800">{stripChapterPrefix(chapter.title)}</p>
                                  <p className="text-xs text-muted-foreground">{chapter.lessons.length} bÃ i há»c</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="ghost" onClick={() => { setEditingChapterId(chapter.id); setEditingChapterTitle(stripChapterPrefix(chapter.title)); setPendingDeleteChapterId(''); }} className="rounded-lg h-9 gap-1.5 text-slate-600">
                                  <Pencil className="size-3.5" /> Äá»•i tÃªn
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setPendingDeleteChapterId((prev) => (prev === chapter.id ? '' : chapter.id))}
                                  className={`rounded-lg h-9 gap-1.5 ${pendingDeleteChapterId === chapter.id ? 'text-red-600 bg-red-50' : 'text-slate-600'}`}>
                                  <Trash2 className="size-3.5" /> XÃ³a
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Delete confirm */}
                        {pendingDeleteChapterId === chapter.id && (
                          <div className="flex items-center justify-between bg-red-50 px-5 py-3 border-b border-red-200">
                            <p className="text-sm font-semibold text-red-700">XÃ¡c nháº­n xÃ³a chÆ°Æ¡ng nÃ y vÃ  toÃ n bá»™ bÃ i há»c?</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={() => void handleDeleteChapter(chapter.id)} className="rounded-lg font-bold h-9">XÃ¡c nháº­n xÃ³a</Button>
                              <Button size="sm" variant="outline" onClick={() => setPendingDeleteChapterId('')} className="rounded-lg h-9">Há»§y</Button>
                            </div>
                          </div>
                        )}

                        {/* Lessons */}
                        <div className="px-5 py-4 space-y-3">
                          {chapter.lessons.length === 0 && (
                            <p className="text-sm text-slate-500 py-2">ChÆ°a cÃ³ bÃ i há»c nÃ o trong chÆ°Æ¡ng nÃ y.</p>
                          )}
                          {chapter.lessons.map((lesson, lessonIndex) => (
                            <div key={lesson.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                              {editingLessonId === lesson.id ? (
                                <div className="space-y-3">
                                  <Input value={editingLessonTitle} onChange={(e) => setEditingLessonTitle(e.target.value)}
                                    placeholder="TÃªn bÃ i há»c" className="h-10 rounded-lg text-sm"
                                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveLessonEdit(); }} />
                                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                    <input type="checkbox" checked={editingLessonFree} onChange={(e) => setEditingLessonFree(e.target.checked)} className="size-4 rounded" />
                                    BÃ i há»c miá»…n phÃ­
                                  </label>
                                  {!editingLessonFree && (
                                    <Input type="number" min={0} value={editingLessonPrice} onChange={(e) => setEditingLessonPrice(e.target.value)}
                                      placeholder="GiÃ¡ lesson tráº£ phÃ­ (VND)" className="h-10 rounded-lg text-sm" />
                                  )}
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => void handleSaveLessonEdit()} className="rounded-lg font-bold h-9">LÆ°u</Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingLessonId(''); setEditingLessonChapterId(''); setEditingLessonTitle(''); setEditingLessonFree(true); setEditingLessonPrice(''); }} className="rounded-lg h-9">Há»§y</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                      <span className="flex size-6 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-600">{lessonIndex + 1}</span>
                                      <div>
                                        <p className="text-sm font-semibold text-slate-800">{lesson.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {lesson.isFree ? 'Miá»…n phÃ­' : 'Tráº£ phÃ­'} &bull; {lesson.videoUrl ? (lesson.sourceType === 'YOUTUBE' ? 'YouTube' : 'Video') : 'ChÆ°a cÃ³ media'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => { startLessonEdit(chapter.id, lesson); setPendingDeleteLessonId(''); }} className="rounded-lg h-8 gap-1.5 text-slate-600">
                                        <Pencil className="size-3" /> Sá»­a
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setPendingDeleteLessonId((prev) => (prev === lesson.id ? '' : lesson.id))}
                                        className={`rounded-lg h-8 gap-1.5 ${pendingDeleteLessonId === lesson.id ? 'text-red-600 bg-red-50' : 'text-slate-600'}`}>
                                        <Trash2 className="size-3" /> XÃ³a
                                      </Button>
                                    </div>
                                  </div>
                                  {pendingDeleteLessonId === lesson.id && (
                                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                                      <p className="flex-1 text-sm font-semibold text-red-700">XÃ³a bÃ i há»c nÃ y?</p>
                                      <Button size="sm" variant="destructive" onClick={() => void handleDeleteLesson(chapter.id, lesson.id)} className="rounded-lg h-8 font-bold">XÃ³a</Button>
                                      <Button size="sm" variant="outline" onClick={() => setPendingDeleteLessonId('')} className="rounded-lg h-8">Há»§y</Button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}

                          {/* Add lesson */}
                          <div className="flex items-end gap-2 pt-1">
                            <div className="flex-1 space-y-1">
                              <Input value={newLessonByChapter[chapter.id] || ''}
                                onChange={(e) => setNewLessonByChapter((prev) => ({ ...prev, [chapter.id]: e.target.value }))}
                                placeholder="TÃªn bÃ i há»c má»›i" className="h-10 rounded-lg text-sm"
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateLesson(chapter.id); }} />
                            </div>
                            <label className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
                              <input type="checkbox" checked={Boolean(newLessonFreeByChapter[chapter.id] ?? true)}
                                onChange={(e) => setNewLessonFreeByChapter((prev) => ({ ...prev, [chapter.id]: e.target.checked }))} className="size-4 rounded" />
                              Free
                            </label>
                            <Button onClick={() => void handleCreateLesson(chapter.id)} className="h-10 rounded-lg font-bold gap-1.5">
                              <Plus className="size-4" /> ThÃªm bÃ i
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay láº¡i
              </Button>
              <Button onClick={() => void handleNext()} disabled={!stepCompletion.step3} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiáº¿p tá»¥c <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP 4: Content â”€â”€ */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadCloud className="size-5 text-primary" />
                  Ná»™i dung bÃ i há»c
                </CardTitle>
                <CardDescription>Upload video, gáº¯n YouTube hoáº·c nháº­p mÃ´ táº£ cho tá»«ng bÃ i há»c.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {curriculum.chapters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
                    <BookOpen className="mx-auto mb-3 size-10 text-slate-300" />
                    <p className="font-semibold">ChÆ°a cÃ³ chÆ°Æ¡ng nÃ o</p>
                    <p className="text-sm mt-1">HÃ£y thÃªm chÆ°Æ¡ng vÃ  bÃ i há»c á»Ÿ bÆ°á»›c GiÃ¡o trÃ¬nh trÆ°á»›c.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {curriculum.chapters.map((chapter, chapterIndex) => (
                      <div key={chapter.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                          <p className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{chapterIndex + 1}</span>
                            {stripChapterPrefix(chapter.title)}
                          </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {chapter.lessons.length === 0 ? (
                            <div className="px-5 py-6 text-sm text-slate-500">ChÆ°a cÃ³ bÃ i há»c.</div>
                          ) : (
                            chapter.lessons.map((lesson) => {
                              const flatPayload = flatLessons.find((item) => item.lesson.id === lesson.id && item.chapterId === chapter.id);
                              if (!flatPayload) return null;
                              const youtubeInput = youtubeUrlByLesson[lesson.id] ?? '';
                              const contentInput = contentByLesson[lesson.id] ?? lesson.content ?? '';
                              const isBusy = uploadingLessonId === lesson.id || savingLessonId === lesson.id;

                              return (
                                <div key={lesson.id} className="p-5 space-y-4">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-slate-800">{lesson.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {lesson.videoUrl ? (lesson.sourceType === 'YOUTUBE' ? 'YouTube' : 'Video') : 'Chá»‰ ná»™i dung vÄƒn báº£n'}
                                      </p>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lesson.isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {lesson.isFree ? 'Miá»…n phÃ­' : 'Tráº£ phÃ­'}
                                    </span>
                                  </div>

                                  {/* Upload / YouTube */}
                                  <div className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
                                    <label className="flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors">
                                      <UploadCloud className="mr-2 size-4" />
                                      {uploadingLessonId === lesson.id ? 'Äang upload...' : 'Upload video'}
                                      <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" className="hidden" disabled={isBusy}
                                        onChange={(event) => { const file = event.target.files?.[0]; void handleUploadLessonVideo(flatPayload, file); event.currentTarget.value = ''; }} />
                                    </label>
                                    <Input value={youtubeInput}
                                      onChange={(e) => setYoutubeUrlByLesson((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                                      placeholder="https://www.youtube.com/watch?v=..." className="h-10 rounded-xl text-sm" disabled={isBusy} />
                                    <Button variant="outline" onClick={() => void handleAttachYoutube(flatPayload)} disabled={isBusy || !youtubeInput}
                                      className="h-10 rounded-xl font-semibold gap-1.5">
                                      LÆ°u YouTube
                                    </Button>
                                  </div>

                                  {(lesson.videoUrl || youtubeInput) && (
                                    <div className="flex justify-start">
                                      <Button variant="ghost" size="sm" onClick={() => void handleClearLessonMedia(flatPayload)} disabled={isBusy}
                                        className="rounded-lg h-9 gap-1.5 text-slate-600 hover:text-red-600">
                                        <X className="size-3.5" /> Bá» media
                                      </Button>
                                    </div>
                                  )}

                                  {/* Description */}
                                  <div className="space-y-1.5">
                                    <label className="text-sm font-semibold">MÃ´ táº£ bÃ i há»c</label>
                                    <textarea className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                                      value={contentInput}
                                      onChange={(e) => setContentByLesson((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                                      placeholder="Nháº­p ná»™i dung/mÃ´ táº£ (khÃ´ng báº¯t buá»™c)" disabled={isBusy} />
                                    <div className="flex justify-end">
                                      <Button variant="outline" size="sm" onClick={() => void handleSaveLessonContent(flatPayload)} disabled={isBusy}
                                        className="rounded-xl font-semibold gap-1.5">
                                        {savingLessonId === lesson.id ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                        LÆ°u mÃ´ táº£
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold">Tá»•ng quan</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ÄÃ£ gáº¯n media: {flatLessons.filter((item) => Boolean(item.lesson.videoUrl)).length}/{flatLessons.length} bÃ i há»c
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay láº¡i
              </Button>
              <Button onClick={() => void handleNext()} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiáº¿p tá»¥c <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* â”€â”€ STEP 5: Publish â”€â”€ */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="size-5 text-primary" />
                  Xuáº¥t báº£n khÃ³a há»c
                </CardTitle>
                <CardDescription>Kiá»ƒm tra Ä‘iá»u kiá»‡n trÆ°á»›c khi cÃ´ng khai khÃ³a há»c cho há»c viÃªn.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: 'CÃ³ Ã­t nháº¥t 1 bÃ i há»c', check: publishGuard.hasAtLeastOneLesson },
                    { label: 'áº¢nh bÃ¬a Ä‘Ã£ upload', check: publishGuard.hasThumbnail },
                    { label: 'GiÃ¡ há»£p lá»‡ khi cÃ³ bÃ i tráº£ phÃ­', check: publishGuard.priceValidForPaidCourse },
                  ].map(({ label, check }) => (
                    <div key={label} className={`flex items-center gap-3 rounded-xl border p-4 ${check ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      {check
                        ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                        : <AlertCircle className="size-5 shrink-0 text-red-600" />}
                      <div>
                        <p className={`text-sm font-semibold ${check ? 'text-emerald-800' : 'text-red-800'}`}>{label}</p>
                        <p className={`text-xs ${check ? 'text-emerald-600' : 'text-red-600'}`}>{check ? 'Äáº¡t' : 'ChÆ°a Ä‘áº¡t'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold">Chi tiáº¿t</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Tá»•ng bÃ i há»c: {publishGuard.lessonCount}</span>
                    <span>BÃ i tráº£ phÃ­: {publishGuard.paidLessonCount}</span>
                    <span>Tráº¡ng thÃ¡i hiá»‡n táº¡i: {course.status || 'DRAFT'}</span>
                    <span>GiÃ¡: {Number(course.price || 0).toLocaleString('vi-VN')} Ä‘</span>
                  </div>
                </div>
                {course.status === 'PUBLISHED' ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <p className="font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      KhÃ³a há»c Ä‘Ã£ xuáº¥t báº£n
                    </p>
                    <p className="text-emerald-700 mt-1">Há»c viÃªn cÃ³ thá»ƒ tÃ¬m tháº¥y khÃ³a há»c nÃ y. Báº¡n cÃ³ thá»ƒ chá»‰nh sá»­a ná»™i dung vÃ  cáº­p nháº­t.</p>
                    <Button variant="outline" asChild className="mt-3 rounded-xl font-semibold gap-1.5">
                      <Link href={`/courses/${course.slug}`} target="_blank">
                        <ExternalLink className="size-4" /> Xem trang cÃ´ng khai
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => void handlePublish()} disabled={!canPublish || publishing}
                    className="w-full rounded-xl font-bold text-base h-14 shadow-lg gap-2">
                    {publishing ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                    {canPublish ? 'Xuáº¥t báº£n khÃ³a há»c' : 'ChÆ°a Ä‘á»§ Ä‘iá»u kiá»‡n xuáº¥t báº£n'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay láº¡i
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€â”€ Modals â”€â”€â”€ */}
      <CreateCategoryModal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={handleCategoryCreated} />
      <CreateCertificateModal open={showCertModal} onClose={() => setShowCertModal(false)} onSuccess={handleCertCreated} />
    </div>
  );
}


