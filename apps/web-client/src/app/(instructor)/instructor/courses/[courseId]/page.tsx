'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Check, ChevronRight, Image as ImageIcon, UploadCloud,
  Plus, Pencil, Trash2, Users, Award, X, Loader2, AlertCircle, CheckCircle2,
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
  getInstructorCommunityGroupsAction,
  publishCourseAction,
  registerYoutubeMediaAction,
  requestCourseThumbnailUploadAction,
  requestLessonUploadAction,
  assignCommunityGroupToCourseAction,
  updateChapterAction,
  updateCourseCertificateTemplatesAction,
  getCourseCertificateTemplatesAction,
  updateCourseAction,
  updateLessonAction,
  createInstructorCommunityGroupAction,
  createInstructorCertificateTemplateAction,
  deleteInstructorCertificateTemplateAction,
  updateInstructorCommunityGroupAction,
  type CourseDto,
  type CourseCurriculumDto,
  type CourseCategoryDto,
  type CertificateTemplateDto,
  type InstructorCommunityGroupDto,
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
  { id: 1, title: 'Cơ bản', subtitle: 'Tiêu đề, danh mục, cộng đồng', icon: <BookOpen className="size-4" /> },
  { id: 2, title: 'Chi tiết', subtitle: 'Mô tả, ảnh bìa, giá, chứng chỉ', icon: <Eye className="size-4" /> },
  { id: 3, title: 'Giáo trình', subtitle: 'Chương và bài học', icon: <BookOpen className="size-4" /> },
  { id: 4, title: 'Nội dung', subtitle: 'Video, YouTube, mô tả', icon: <UploadCloud className="size-4" /> },
  { id: 5, title: 'Xuất bản', subtitle: 'Kiểm tra và công khai', icon: <Check className="size-4" /> },
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

// ─── Inline Category Creation Modal ──────────────────────────────────────────
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
    if (!name.trim() || name.trim().length < 2) {
      setError('Tên danh mục cần ít nhất 2 ký tự.');
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
        setError(result.message || 'Không thể tạo danh mục.');
      }
    } catch {
      setError('Đã có lỗi hệ thống.');
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
          aria-labelledby="modal-cat-title"
          className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 id="modal-cat-title" className="text-lg font-bold">Tạo danh mục mới</h3>
            <button onClick={onClose} aria-label="Đóng" className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="cat-name" className="mb-1.5 block text-sm font-semibold">Tên danh mục</label>
              <Input id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Lập trình Web, Marketing..."
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
                autoFocus
              />
            </div>
            {error && <StatusMessage type="error" message={error} />}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">Hủy</Button>
              <Button onClick={() => void handleCreate()} disabled={loading} className="rounded-xl font-bold">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Tạo danh mục
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

// ─── Inline Community Group Creation Modal ───────────────────────────────────
interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (group: InstructorCommunityGroupDto) => void;
}

function CreateGroupModal({ open, onClose, onSuccess }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setDescription(''); setError(''); }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError('Tên nhóm cần ít nhất 2 ký tự.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createInstructorCommunityGroupAction({ name: name.trim(), description: description.trim() || undefined });
      if (result.success && result.data) {
        onSuccess(result.data);
        onClose();
      } else {
        setError(result.message || 'Không thể tạo nhóm.');
      }
    } catch {
      setError('Đã có lỗi hệ thống.');
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
          aria-labelledby="modal-group-title"
          className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 id="modal-group-title" className="text-lg font-bold">Tạo nhóm cộng đồng mới</h3>
            <button onClick={onClose} aria-label="Đóng" className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="new-group-name" className="mb-1.5 block text-sm font-semibold">Tên nhóm</label>
              <Input id="new-group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Cộng đồng React VN" onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }} autoFocus />
            </div>
            <div>
              <label htmlFor="new-group-desc" className="mb-1.5 block text-sm font-semibold">Mô tả (tùy chọn)</label>
              <textarea id="new-group-desc" className="min-h-20 w-full rounded-md border border-slate-200 bg-white p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn về nhóm..." />
            </div>
            {error && <StatusMessage type="error" message={error} />}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">Hủy</Button>
              <Button onClick={() => void handleCreate()} disabled={loading} className="rounded-xl font-bold">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Tạo nhóm
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

// ─── Inline Certificate Template Creation Modal ──────────────────────────────
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
      setError('Tên mẫu chứng chỉ cần ít nhất 2 ký tự.');
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
        setError(result.message || 'Không thể tạo mẫu chứng chỉ.');
      }
    } catch {
      setError('Đã có lỗi hệ thống.');
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
            <h3 id="modal-cert-title" className="text-lg font-bold">Tạo mẫu chứng chỉ mới</h3>
            <button onClick={onClose} aria-label="Đóng" className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="cert-tmpl-name" className="mb-1.5 block text-sm font-semibold">Tên mẫu chứng chỉ</label>
              <Input id="cert-tmpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Chứng nhận hoàn thành khóa học" onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }} autoFocus />
            </div>
            <div>
              <label htmlFor="cert-tmpl-desc" className="mb-1.5 block text-sm font-semibold">Mô tả (tùy chọn)</label>
              <textarea id="cert-tmpl-desc" className="min-h-20 w-full rounded-md border border-slate-200 bg-white p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả về chứng chỉ này..." />
            </div>
            {error && <StatusMessage type="error" message={error} />}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">Hủy</Button>
              <Button onClick={() => void handleCreate()} disabled={loading} className="rounded-xl font-bold">
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Tạo mẫu chứng chỉ
              </Button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
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
  const [communityGroups, setCommunityGroups] = useState<InstructorCommunityGroupDto[]>([]);
  const [certificateTemplates, setCertificateTemplates] = useState<CertificateTemplateDto[]>([]);
  const [publishGuard, setPublishGuard] = useState<PublishGuardDto | null>(null);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // Step 1 state
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState<LevelValue>('BEGINNER');
  const [language, setLanguage] = useState('vi');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [savingGroupId, setSavingGroupId] = useState(false);
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
      const [catResult, groupResult, templateResult, courseTemplatesResult] = await Promise.all([
        getCourseCategoriesAction(),
        getInstructorCommunityGroupsAction(),
        getInstructorCertificateTemplatesAction(),
        getCourseCertificateTemplatesAction(courseId),
      ]);

      if (catResult.success && catResult.data) setCategories(catResult.data);
      if (groupResult.success && groupResult.data) {
        setCommunityGroups(groupResult.data);
        const currentGroup = groupResult.data.find((g: InstructorCommunityGroupDto) => g.courseId === courseId)
          || groupResult.data.find((g: InstructorCommunityGroupDto) => g.courseId === c.communityGroups?.[0]?.id);
        setSelectedGroupId(currentGroup?.id || '');
      }
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

  // ─── Save Functions ──────────────────────────────────────────────────────

  const saveStep1 = useCallback(async (): Promise<boolean> => {
    if (!course) return false;
    if (title.trim().length < 3) { setStatus('error', 'Tiêu đề cần ít nhất 3 ký tự.'); return false; }
    if (!categoryId.trim()) { setStatus('error', 'Vui lòng chọn danh mục.'); return false; }

    setSavingStep(true);
    const result = await updateCourseAction(course.id, { title: title.trim(), categoryId, level });
    setSavingStep(false);

    if (!result.success || !result.data) {
      setStatus('error', result.message || 'Không thể lưu bước 1.');
      return false;
    }

    setCourse(result.data);
    setLastSavedAt(new Date());
    setStatus('success', 'Đã lưu thông tin cơ bản.');
    return true;
  }, [course, title, categoryId, level]);

  const saveGroupAssignment = useCallback(async (): Promise<boolean> => {
    if (!course || !selectedGroupId) return true;
    setSavingGroupId(true);
    const result = await assignCommunityGroupToCourseAction(selectedGroupId, course.id);
    setSavingGroupId(false);
    if (!result.success) {
      setStatus('error', result.message || 'Không lưu được gán nhóm cộng đồng.');
      return false;
    }
    return true;
  }, [course, selectedGroupId]);

  const saveTemplateSelection = useCallback(async (): Promise<boolean> => {
    if (!course) return true;
    setSavingTemplates(true);
    const result = await updateCourseCertificateTemplatesAction(course.id, selectedTemplateIds);
    setSavingTemplates(false);
    if (!result.success) {
      setStatus('error', result.message || 'Không lưu được chứng chỉ.');
      return false;
    }
    return true;
  }, [course, selectedTemplateIds]);

  const saveStep2 = useCallback(async (): Promise<boolean> => {
    if (!course) return false;
    const parsedPrice = Number(price);
    if (pricingMode === 'PAID' && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      setStatus('error', 'Khóa học trả phí yêu cầu giá lớn hơn 0.');
      return false;
    }
    if (!thumbnail.trim()) {
      setStatus('error', 'Bắt buộc phải có ảnh bìa.');
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
    setStatus('success', 'Đã lưu chi tiết khóa học.');
    await loadWizardData();
    return true;
  }, [course, price, pricingMode, thumbnail, description, loadWizardData]);

  const handleSaveStep1 = async () => {
    const ok = await saveStep1();
    if (ok) await saveGroupAssignment();
    if (ok) await saveTemplateSelection();
  };

  const navigateStep = useCallback(async (nextStep: WizardStep) => {
    if (nextStep === currentStep) return;

    if (nextStep > currentStep) {
      if (currentStep === 1) {
        const ok = await saveStep1();
        if (!ok) return;
        await saveGroupAssignment();
        await saveTemplateSelection();
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
    if (nextStep === 5) await loadWizardData();
  }, [currentStep, saveStep1, saveStep2, isStepUnlocked, searchParams, router, courseId, loadWizardData, saveGroupAssignment, saveTemplateSelection]);

  const handleNext = async () => {
    const target = Math.min(5, currentStep + 1) as WizardStep;
    await navigateStep(target);
  };

  const handlePrevious = async () => {
    const target = Math.max(1, currentStep - 1) as WizardStep;
    await navigateStep(target);
  };

  // ─── Upload helpers ──────────────────────────────────────────────────────

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
      if (!presigned.success || !presigned.data) { setStatus('error', presigned.message || 'Không tạo được phiên upload ảnh bìa.'); return; }
      const uploaded = await uploadWithPresigned(presigned.data.presignedUrl, file, presigned.data.uploadMethod === 'POST_FORM' ? presigned.data.uploadFields : undefined);
      if (!uploaded) { setStatus('error', 'Upload ảnh bìa thất bại.'); return; }
      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) { setStatus('error', confirmed.message || 'Không xác nhận được ảnh bìa.'); return; }
      const nextThumbnail = confirmed.data.url;
      setThumbnail(nextThumbnail);
      setLastSavedAt(new Date());
      setStatus('success', 'Ảnh bìa đã được upload và lưu.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const buildNumberedChapterTitle = useCallback((chapterIndex: number, rawTitle: string): string => {
    const cleanTitle = stripChapterPrefix(rawTitle || '').trim();
    if (!cleanTitle) return `Chương ${chapterIndex}`;
    return `Chương ${chapterIndex}: ${cleanTitle}`;
  }, []);

  // ─── Curriculum handlers ─────────────────────────────────────────────────

  const handleCreateChapter = async () => {
    if (!course || !curriculum) return;
    const nextChapterIndex = curriculum.chapters.length + 1;
    const chapterTitle = buildNumberedChapterTitle(nextChapterIndex, newChapterTitle);
    const result = await createChapterAction(course.id, chapterTitle);
    if (!result.success) { setStatus('error', result.message || 'Không tạo được chương.'); return; }
    setNewChapterTitle('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã thêm chương mới.');
  };

  const handleRenameChapter = async (chapterId: string) => {
    if (!course || !curriculum) return;
    const chapterIndex = curriculum.chapters.findIndex((ch) => ch.id === chapterId) + 1;
    if (chapterIndex <= 0) { setStatus('error', 'Không tìm thấy chương cần cập nhật.'); return; }
    const finalTitle = buildNumberedChapterTitle(chapterIndex, editingChapterTitle);
    const result = await updateChapterAction(course.id, chapterId, { title: finalTitle });
    if (!result.success) { setStatus('error', result.message || 'Không đổi tên được chương.'); return; }
    setEditingChapterId('');
    setEditingChapterTitle('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã đổi tên chương.');
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!course) return;
    const result = await deleteChapterAction(course.id, chapterId);
    if (!result.success) { setStatus('error', result.message || 'Không xóa được chương.'); return; }
    setPendingDeleteChapterId('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã xóa chương.');
  };

  const syncCoursePriceForPaidLesson = useCallback(async (lessonPriceText: string): Promise<boolean> => {
    if (!course) return false;
    const parsed = Number(lessonPriceText);
    if (!Number.isFinite(parsed) || parsed <= 0) { setStatus('error', 'Lesson trả phí bắt buộc nhập giá hợp lệ.'); return false; }
    const courseUpdated = await updateCourseAction(course.id, { price: parsed });
    if (!courseUpdated.success || !courseUpdated.data) { setStatus('error', courseUpdated.message || 'Không cập nhật được giá.'); return false; }
    setCourse(courseUpdated.data);
    setPricingMode('PAID');
    setPrice(String(parsed));
    return true;
  }, [course]);

  const handleCreateLesson = async (chapterId: string) => {
    if (!course) return;
    const nextTitle = (newLessonByChapter[chapterId] || '').trim();
    if (nextTitle.length < 2) { setStatus('error', 'Tên bài học cần ít nhất 2 ký tự.'); return; }
    const isFree = newLessonFreeByChapter[chapterId] ?? true;
    const lessonPriceText = (newLessonPriceByChapter[chapterId] || '').trim();
    if (!isFree) { const okPrice = await syncCoursePriceForPaidLesson(lessonPriceText); if (!okPrice) return; }
    const result = await createLessonAction(course.id, chapterId, nextTitle, isFree);
    if (!result.success) { setStatus('error', result.message || 'Không tạo được bài học.'); return; }
    setNewLessonByChapter((prev) => ({ ...prev, [chapterId]: '' }));
    setNewLessonFreeByChapter((prev) => ({ ...prev, [chapterId]: true }));
    setNewLessonPriceByChapter((prev) => ({ ...prev, [chapterId]: '' }));
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã thêm bài học mới.');
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
    if (editingLessonTitle.trim().length < 2) { setStatus('error', 'Tên bài học cần ít nhất 2 ký tự.'); return; }
    if (!editingLessonFree) { const okPrice = await syncCoursePriceForPaidLesson(editingLessonPrice); if (!okPrice) return; }
    const result = await updateLessonAction(course.id, editingLessonChapterId, editingLessonId, { title: editingLessonTitle.trim(), isFree: editingLessonFree });
    if (!result.success) { setStatus('error', result.message || 'Không chỉnh sửa được bài học.'); return; }
    setEditingLessonId(''); setEditingLessonChapterId(''); setEditingLessonTitle(''); setEditingLessonPrice(''); setEditingLessonFree(true);
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã cập nhật bài học.');
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!course) return;
    const result = await deleteLessonAction(course.id, chapterId, lessonId);
    if (!result.success) { setStatus('error', result.message || 'Không xóa được bài học.'); return; }
    setPendingDeleteLessonId('');
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Đã xóa bài học.');
  };

  const handleUploadLessonVideo = async (payload: FlatLesson, file?: File | null) => {
    if (!file || !course) return;
    setUploadingLessonId(payload.lesson.id);
    try {
      const presigned = await requestLessonUploadAction({ filename: file.name, mimeType: file.type || 'video/mp4', size: file.size, courseId: course.id, lessonId: payload.lesson.id });
      if (!presigned.success || !presigned.data) { setStatus('error', presigned.message || 'Không tạo được phiên upload.'); return; }
      const uploaded = await uploadWithPresigned(presigned.data.presignedUrl, file, presigned.data.uploadMethod === 'POST_FORM' ? presigned.data.uploadFields : undefined);
      if (!uploaded) { setStatus('error', 'Upload video thất bại.'); return; }
      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) { setStatus('error', confirmed.message || 'Không xác nhận được video.'); return; }
      const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { videoUrl: confirmed.data.url, sourceType: 'UPLOAD' });
      if (!updated.success) { setStatus('error', updated.message || 'Không cập nhật được lesson.'); return; }
      await loadWizardData();
      setLastSavedAt(new Date());
      setStatus('success', `Đã upload video cho "${payload.lesson.title}".`);
    } finally {
      setUploadingLessonId('');
    }
  };

  const handleAttachYoutube = async (payload: FlatLesson) => {
    if (!course) return;
    const youtubeUrl = (youtubeUrlByLesson[payload.lesson.id] || '').trim();
    if (!youtubeUrl) { setStatus('error', 'Vui lòng nhập URL YouTube.'); return; }
    setSavingLessonId(payload.lesson.id);
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { sourceType: 'YOUTUBE', videoUrl: youtubeUrl });
    if (!updated.success) { setSavingLessonId(''); setStatus('error', updated.message || 'Không cập nhật được.'); return; }
    await registerYoutubeMediaAction({ title: payload.lesson.title, youtubeUrl, courseId: course.id, lessonId: payload.lesson.id });
    await loadWizardData();
    setSavingLessonId('');
    setLastSavedAt(new Date());
    setStatus('success', `Đã gắn YouTube cho "${payload.lesson.title}".`);
  };

  const handleClearLessonMedia = async (payload: FlatLesson) => {
    if (!course) return;
    setSavingLessonId(payload.lesson.id);
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { sourceType: 'UPLOAD', videoUrl: null });
    if (!updated.success) { setSavingLessonId(''); setStatus('error', updated.message || 'Không thể bỏ media.'); return; }
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
    const updated = await updateLessonAction(course.id, payload.chapterId, payload.lesson.id, { content: nextContent.length > 0 ? nextContent : null });
    setSavingLessonId('');
    if (!updated.success) { setStatus('error', updated.message || 'Không lưu được mô tả.'); return; }
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', `Đã lưu mô tả cho "${payload.lesson.title}".`);
  };

  const handlePublish = async () => {
    if (!course) return;
    const step2Saved = await saveStep2();
    if (!step2Saved) return;
    setPublishing(true);
    const result = await publishCourseAction(course.id, thumbnail.trim() || undefined);
    setPublishing(false);
    if (!result.success) { setStatus('error', result.message || 'Không thể publish.'); await loadWizardData(); return; }
    const publicSlug = result.data?.slug || course.slug;
    if (publicSlug) { router.push(`/courses/${publicSlug}`); return; }
    await loadWizardData();
    setLastSavedAt(new Date());
    setStatus('success', 'Publish thành công.');
  };

  // ─── Category/Group/Cert handlers ────────────────────────────────────────

  const handleCategoryCreated = (category: CourseCategoryDto) => {
    setCategories((prev) => [...prev, category]);
    setCategoryId(category.id);
  };

  const handleGroupCreated = (group: InstructorCommunityGroupDto) => {
    setCommunityGroups((prev) => [...prev, group]);
    setSelectedGroupId(group.id);
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
    return <div className="p-8 text-muted-foreground">Không tìm thấy khóa học.</div>;
  }

  const canPublish = publishGuard.hasAtLeastOneLesson && publishGuard.hasThumbnail && publishGuard.priceValidForPaidCourse;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-6xl px-8 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/instructor/courses" className="flex items-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="mr-1.5 size-4" /> Quay lại
              </Link>
              <div className="h-5 w-px bg-slate-200" />
              <h1 className="text-xl font-bold tracking-tight">{course.title || 'Khóa học mới'}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${course.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {course.status || 'DRAFT'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {savingStep ? (
                <span className="flex items-center gap-1.5 text-amber-600"><Loader2 className="size-3.5 animate-spin" /> Đang lưu...</span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> Lưu lúc {formatSavedAt(lastSavedAt)}</span>
              ) : (
                <span className="flex items-center gap-1.5"><AlertCircle className="size-3.5 text-slate-400" /> Chưa lưu</span>
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

      {/* ─── Content ─── */}
      <div className="mx-auto max-w-6xl px-8 py-6">
        {statusMessage && (
          <div className="mb-4"><StatusMessage type={statusType} message={statusMessage} /></div>
        )}

        {/* ── STEP 1: Basic ── */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  Thông tin cơ bản
                </CardTitle>
                <CardDescription>Tiêu đề, danh mục, trình độ và ngôn ngữ là bắt buộc để tiếp tục.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Tiêu đề khóa học</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: React.js Thực chiến Doanh nghiệp" className="h-12 rounded-xl text-base" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 flex items-center justify-between text-sm font-semibold">
                      Danh mục
                      <button onClick={() => setShowCategoryModal(true)} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <Plus className="size-3" /> Tạo mới
                      </button>
                    </label>
                    <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="">Chọn danh mục</option>
                      {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Trình độ</label>
                    <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={level} onChange={(e) => setLevel(e.target.value as LevelValue)}>
                      <option value="BEGINNER">Người mới bắt đầu</option>
                      <option value="INTERMEDIATE">Trung cấp</option>
                      <option value="ADVANCED">Nâng cao</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Ngôn ngữ</label>
                    <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={language} onChange={(e) => { setLanguage(e.target.value); window.localStorage.setItem(`course-wizard-language-${courseId}`, e.target.value); }}>
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">English</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => void handleSaveStep1()} disabled={savingStep || savingGroupId || savingTemplates} className="rounded-xl font-bold gap-2 shadow-md">
                    {savingStep ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Lưu thông tin cơ bản
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Community Group selection */}
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  Nhóm cộng đồng
                </CardTitle>
                <CardDescription>Chọn nhóm cộng đồng để học viên tham gia khi đăng ký khóa học. Bạn có thể tạo nhóm mới tại tab Nhóm cộng đồng.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <select className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm max-w-md" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
                    <option value="">Không chọn nhóm cộng đồng</option>
                    {communityGroups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.memberCount} thành viên)</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowGroupModal(true)} className="rounded-xl font-semibold gap-1.5 h-12">
                      <Plus className="size-4" /> Tạo nhóm mới
                    </Button>
                    <Button onClick={() => void saveGroupAssignment()} disabled={savingGroupId || !selectedGroupId} className="rounded-xl font-bold gap-1.5 h-12">
                      {savingGroupId ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Lưu nhóm
                    </Button>
                  </div>
                </div>
                {communityGroups.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    <Users className="mb-1.5 size-4 text-slate-400" />
                    Bạn chưa có nhóm cộng đồng nào. Hãy tạo nhóm mới để học viên có thể tham gia thảo luận.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-end">
              <Button onClick={() => void handleNext()} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiếp tục <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="size-5 text-primary" />
                  Chi tiết khóa học
                </CardTitle>
                <CardDescription>Mô tả, ảnh bìa và định giá là bắt buộc để có thể xuất bản.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Mô tả khóa học</label>
                  <textarea className="min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nhập mô tả chi tiết về khóa học..." />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Ảnh bìa</label>
                  <div className="flex aspect-video max-w-sm items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    {thumbnail ? (
                      <Image src={thumbnail} alt="thumbnail" width={640} height={360} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-sm font-semibold text-slate-500">
                        <ImageIcon className="mb-2 size-10 text-slate-300" />
                        Chưa có ảnh bìa
                      </div>
                    )}
                  </div>
                  <label className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors">
                    <UploadCloud className="mr-2 size-4" />
                    {isUploadingThumbnail ? 'Đang upload...' : 'Upload ảnh bìa'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={isUploadingThumbnail}
                      onChange={(event) => { const file = event.target.files?.[0]; void handleUploadThumbnail(file); event.currentTarget.value = ''; }} />
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Định giá</label>
                  <div className="flex gap-3 mb-3">
                    <Button type="button" variant={pricingMode === 'FREE' ? 'default' : 'outline'} onClick={() => { setPricingMode('FREE'); setPrice('0'); }} className="rounded-xl font-semibold gap-1.5">
                      Miễn phí
                    </Button>
                    <Button type="button" variant={pricingMode === 'PAID' ? 'default' : 'outline'} onClick={() => setPricingMode('PAID')} className="rounded-xl font-semibold gap-1.5">
                      Trả phí
                    </Button>
                  </div>
                  <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} disabled={pricingMode === 'FREE'}
                    placeholder="Giá (VND)" className="max-w-xs rounded-xl h-12 text-base" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => void saveStep2()} disabled={savingStep || isUploadingThumbnail} className="rounded-xl font-bold gap-2 shadow-md">
                    {savingStep ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Lưu chi tiết
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Certificate selection */}
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="size-5 text-primary" />
                  Chứng chỉ cho khóa học
                </CardTitle>
                <CardDescription>Chọn mẫu chứng chỉ mà học viên sẽ nhận được khi hoàn thành khóa học.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex flex-wrap gap-2 flex-1">
                    {certificateTemplates.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 w-full">
                        <Award className="mb-1.5 size-4 text-slate-400" />
                        Bạn chưa có mẫu chứng chỉ nào. Tạo mẫu mới tại tab Chứng chỉ hoặc bấm nút bên dưới.
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
                    <Plus className="size-4" /> Tạo mẫu mới
                  </Button>
                  <Button onClick={() => void saveTemplateSelection()} disabled={savingTemplates} className="rounded-xl font-bold gap-1.5 h-12 shrink-0">
                    {savingTemplates ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Lưu
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay lại
              </Button>
              <Button onClick={() => void handleNext()} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiếp tục <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Curriculum ── */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  Xây dựng giáo trình
                </CardTitle>
                <CardDescription>Tạo chương và bài học. Hệ thống tự đánh số chương.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <Input value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)}
                    placeholder="Tên chương (hệ thống tự đánh số Chương 1, 2...)"
                    className="h-12 rounded-xl text-base" onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateChapter(); }} />
                  <Button onClick={() => void handleCreateChapter()} className="h-12 rounded-xl font-bold gap-1.5 shadow-md" disabled={!newChapterTitle.trim()}>
                    <Plus className="size-4" /> Thêm chương
                  </Button>
                </div>

                {curriculum.chapters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
                    <BookOpen className="mx-auto mb-3 size-10 text-slate-300" />
                    <p className="font-semibold">Chưa có chương nào</p>
                    <p className="text-sm mt-1">Bắt đầu bằng cách thêm chương đầu tiên ở trên.</p>
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
                              <Button size="sm" onClick={() => void handleRenameChapter(chapter.id)} className="rounded-lg font-bold h-9">Lưu</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingChapterId(''); setEditingChapterTitle(''); }} className="rounded-lg h-9">Hủy</Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{chapterIndex + 1}</span>
                                <div>
                                  <p className="font-bold text-slate-800">{stripChapterPrefix(chapter.title)}</p>
                                  <p className="text-xs text-muted-foreground">{chapter.lessons.length} bài học</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="ghost" onClick={() => { setEditingChapterId(chapter.id); setEditingChapterTitle(stripChapterPrefix(chapter.title)); setPendingDeleteChapterId(''); }} className="rounded-lg h-9 gap-1.5 text-slate-600">
                                  <Pencil className="size-3.5" /> Đổi tên
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setPendingDeleteChapterId((prev) => (prev === chapter.id ? '' : chapter.id))}
                                  className={`rounded-lg h-9 gap-1.5 ${pendingDeleteChapterId === chapter.id ? 'text-red-600 bg-red-50' : 'text-slate-600'}`}>
                                  <Trash2 className="size-3.5" /> Xóa
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Delete confirm */}
                        {pendingDeleteChapterId === chapter.id && (
                          <div className="flex items-center justify-between bg-red-50 px-5 py-3 border-b border-red-200">
                            <p className="text-sm font-semibold text-red-700">Xác nhận xóa chương này và toàn bộ bài học?</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={() => void handleDeleteChapter(chapter.id)} className="rounded-lg font-bold h-9">Xác nhận xóa</Button>
                              <Button size="sm" variant="outline" onClick={() => setPendingDeleteChapterId('')} className="rounded-lg h-9">Hủy</Button>
                            </div>
                          </div>
                        )}

                        {/* Lessons */}
                        <div className="px-5 py-4 space-y-3">
                          {chapter.lessons.length === 0 && (
                            <p className="text-sm text-slate-500 py-2">Chưa có bài học nào trong chương này.</p>
                          )}
                          {chapter.lessons.map((lesson, lessonIndex) => (
                            <div key={lesson.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                              {editingLessonId === lesson.id ? (
                                <div className="space-y-3">
                                  <Input value={editingLessonTitle} onChange={(e) => setEditingLessonTitle(e.target.value)}
                                    placeholder="Tên bài học" className="h-10 rounded-lg text-sm"
                                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveLessonEdit(); }} />
                                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                    <input type="checkbox" checked={editingLessonFree} onChange={(e) => setEditingLessonFree(e.target.checked)} className="size-4 rounded" />
                                    Bài học miễn phí
                                  </label>
                                  {!editingLessonFree && (
                                    <Input type="number" min={0} value={editingLessonPrice} onChange={(e) => setEditingLessonPrice(e.target.value)}
                                      placeholder="Giá lesson trả phí (VND)" className="h-10 rounded-lg text-sm" />
                                  )}
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => void handleSaveLessonEdit()} className="rounded-lg font-bold h-9">Lưu</Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingLessonId(''); setEditingLessonChapterId(''); setEditingLessonTitle(''); setEditingLessonFree(true); setEditingLessonPrice(''); }} className="rounded-lg h-9">Hủy</Button>
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
                                          {lesson.isFree ? 'Miễn phí' : 'Trả phí'} &bull; {lesson.videoUrl ? (lesson.sourceType === 'YOUTUBE' ? 'YouTube' : 'Video') : 'Chưa có media'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => { startLessonEdit(chapter.id, lesson); setPendingDeleteLessonId(''); }} className="rounded-lg h-8 gap-1.5 text-slate-600">
                                        <Pencil className="size-3" /> Sửa
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setPendingDeleteLessonId((prev) => (prev === lesson.id ? '' : lesson.id))}
                                        className={`rounded-lg h-8 gap-1.5 ${pendingDeleteLessonId === lesson.id ? 'text-red-600 bg-red-50' : 'text-slate-600'}`}>
                                        <Trash2 className="size-3" /> Xóa
                                      </Button>
                                    </div>
                                  </div>
                                  {pendingDeleteLessonId === lesson.id && (
                                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                                      <p className="flex-1 text-sm font-semibold text-red-700">Xóa bài học này?</p>
                                      <Button size="sm" variant="destructive" onClick={() => void handleDeleteLesson(chapter.id, lesson.id)} className="rounded-lg h-8 font-bold">Xóa</Button>
                                      <Button size="sm" variant="outline" onClick={() => setPendingDeleteLessonId('')} className="rounded-lg h-8">Hủy</Button>
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
                                placeholder="Tên bài học mới" className="h-10 rounded-lg text-sm"
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateLesson(chapter.id); }} />
                            </div>
                            <label className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
                              <input type="checkbox" checked={Boolean(newLessonFreeByChapter[chapter.id] ?? true)}
                                onChange={(e) => setNewLessonFreeByChapter((prev) => ({ ...prev, [chapter.id]: e.target.checked }))} className="size-4 rounded" />
                              Free
                            </label>
                            <Button onClick={() => void handleCreateLesson(chapter.id)} className="h-10 rounded-lg font-bold gap-1.5">
                              <Plus className="size-4" /> Thêm bài
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
                <ArrowLeft className="size-4" /> Quay lại
              </Button>
              <Button onClick={() => void handleNext()} disabled={!stepCompletion.step3} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiếp tục <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Content ── */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadCloud className="size-5 text-primary" />
                  Nội dung bài học
                </CardTitle>
                <CardDescription>Upload video, gắn YouTube hoặc nhập mô tả cho từng bài học.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {curriculum.chapters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500">
                    <BookOpen className="mx-auto mb-3 size-10 text-slate-300" />
                    <p className="font-semibold">Chưa có chương nào</p>
                    <p className="text-sm mt-1">Hãy thêm chương và bài học ở bước Giáo trình trước.</p>
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
                            <div className="px-5 py-6 text-sm text-slate-500">Chưa có bài học.</div>
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
                                        {lesson.videoUrl ? (lesson.sourceType === 'YOUTUBE' ? 'YouTube' : 'Video') : 'Chỉ nội dung văn bản'}
                                      </p>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lesson.isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {lesson.isFree ? 'Miễn phí' : 'Trả phí'}
                                    </span>
                                  </div>

                                  {/* Upload / YouTube */}
                                  <div className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
                                    <label className="flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors">
                                      <UploadCloud className="mr-2 size-4" />
                                      {uploadingLessonId === lesson.id ? 'Đang upload...' : 'Upload video'}
                                      <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo" className="hidden" disabled={isBusy}
                                        onChange={(event) => { const file = event.target.files?.[0]; void handleUploadLessonVideo(flatPayload, file); event.currentTarget.value = ''; }} />
                                    </label>
                                    <Input value={youtubeInput}
                                      onChange={(e) => setYoutubeUrlByLesson((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                                      placeholder="https://www.youtube.com/watch?v=..." className="h-10 rounded-xl text-sm" disabled={isBusy} />
                                    <Button variant="outline" onClick={() => void handleAttachYoutube(flatPayload)} disabled={isBusy || !youtubeInput}
                                      className="h-10 rounded-xl font-semibold gap-1.5">
                                      Lưu YouTube
                                    </Button>
                                  </div>

                                  {(lesson.videoUrl || youtubeInput) && (
                                    <div className="flex justify-start">
                                      <Button variant="ghost" size="sm" onClick={() => void handleClearLessonMedia(flatPayload)} disabled={isBusy}
                                        className="rounded-lg h-9 gap-1.5 text-slate-600 hover:text-red-600">
                                        <X className="size-3.5" /> Bỏ media
                                      </Button>
                                    </div>
                                  )}

                                  {/* Description */}
                                  <div className="space-y-1.5">
                                    <label className="text-sm font-semibold">Mô tả bài học</label>
                                    <textarea className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                                      value={contentInput}
                                      onChange={(e) => setContentByLesson((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                                      placeholder="Nhập nội dung/mô tả (không bắt buộc)" disabled={isBusy} />
                                    <div className="flex justify-end">
                                      <Button variant="outline" size="sm" onClick={() => void handleSaveLessonContent(flatPayload)} disabled={isBusy}
                                        className="rounded-xl font-semibold gap-1.5">
                                        {savingLessonId === lesson.id ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                        Lưu mô tả
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
                  <p className="text-sm font-semibold">Tổng quan</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Đã gắn media: {flatLessons.filter((item) => Boolean(item.lesson.videoUrl)).length}/{flatLessons.length} bài học
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay lại
              </Button>
              <Button onClick={() => void handleNext()} className="rounded-xl font-bold gap-2 shadow-md px-8">
                Tiếp tục <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Publish ── */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-white/60 bg-white/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="size-5 text-primary" />
                  Xuất bản khóa học
                </CardTitle>
                <CardDescription>Kiểm tra điều kiện trước khi công khai khóa học cho học viên.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: 'Có ít nhất 1 bài học', check: publishGuard.hasAtLeastOneLesson },
                    { label: 'Ảnh bìa đã upload', check: publishGuard.hasThumbnail },
                    { label: 'Giá hợp lệ khi có bài trả phí', check: publishGuard.priceValidForPaidCourse },
                  ].map(({ label, check }) => (
                    <div key={label} className={`flex items-center gap-3 rounded-xl border p-4 ${check ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      {check
                        ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                        : <AlertCircle className="size-5 shrink-0 text-red-600" />}
                      <div>
                        <p className={`text-sm font-semibold ${check ? 'text-emerald-800' : 'text-red-800'}`}>{label}</p>
                        <p className={`text-xs ${check ? 'text-emerald-600' : 'text-red-600'}`}>{check ? 'Đạt' : 'Chưa đạt'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold">Chi tiết</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Tổng bài học: {publishGuard.lessonCount}</span>
                    <span>Bài trả phí: {publishGuard.paidLessonCount}</span>
                    <span>Trạng thái hiện tại: {course.status || 'DRAFT'}</span>
                    <span>Giá: {Number(course.price || 0).toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
                {course.status === 'PUBLISHED' ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <p className="font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Khóa học đã xuất bản
                    </p>
                    <p className="text-emerald-700 mt-1">Học viên có thể tìm thấy khóa học này. Bạn có thể chỉnh sửa nội dung và cập nhật.</p>
                    <Button variant="outline" asChild className="mt-3 rounded-xl font-semibold gap-1.5">
                      <Link href={`/courses/${course.slug}`} target="_blank">
                        <ExternalLink className="size-4" /> Xem trang công khai
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => void handlePublish()} disabled={!canPublish || publishing}
                    className="w-full rounded-xl font-bold text-base h-14 shadow-lg gap-2">
                    {publishing ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                    {canPublish ? 'Xuất bản khóa học' : 'Chưa đủ điều kiện xuất bản'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => void handlePrevious()} className="rounded-xl font-bold gap-2">
                <ArrowLeft className="size-4" /> Quay lại
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      <CreateCategoryModal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSuccess={handleCategoryCreated} />
      <CreateGroupModal open={showGroupModal} onClose={() => setShowGroupModal(false)} onSuccess={handleGroupCreated} />
      <CreateCertificateModal open={showCertModal} onClose={() => setShowCertModal(false)} onSuccess={handleCertCreated} />
    </div>
  );
}
