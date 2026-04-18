'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, GripVertical, Plus, Video, AlignLeft, Edit3, Trash2, UploadCloud, Link2 } from 'lucide-react';
import Link from 'next/link';
import { StatusMessage } from '@/components/ui/status-message';
import {
  getCourseCurriculumAction,
  updateCurriculumOrderAction,
  createChapterAction,
  updateChapterAction,
  deleteChapterAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  requestLessonUploadAction,
  confirmLessonUploadAction,
  registerYoutubeMediaAction,
} from '@/app/actions/instructor';

interface LessonView {
  id: string;
  title: string;
  videoUrl?: string | null;
  sourceType: 'UPLOAD' | 'YOUTUBE';
  isFree: boolean;
  isPublished: boolean;
  type: 'video' | 'text';
}

interface ChapterView {
  id: string;
  title: string;
  lessons: LessonView[];
}

function getYoutubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.replace('/', '').trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = parsed.searchParams.get('v')?.trim();
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export default function CurriculumEditorPage() {
  const params = useParams();
  const [chapters, setChapters] = useState<ChapterView[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingLessonId, setUploadingLessonId] = useState<string>('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [selectedLessonKey, setSelectedLessonKey] = useState('');
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [statusMessage, setStatusMessage] = useState('');
  const [isCreatingDemoLessons, setIsCreatingDemoLessons] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  const allLessons = chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lesson,
      key: `${chapter.id}::${lesson.id}`,
    })),
  );

  const selectedLesson = allLessons.find((item) => item.key === selectedLessonKey);

  useEffect(() => {
    setIsPreviewExpanded(false);
  }, [selectedLessonKey]);

  useEffect(() => {
    setMounted(true); // Prevent SSR mismatch with DragDropContext
    const fetchCurriculum = async () => {
      const courseId = String(params.courseId);
      const result = await getCourseCurriculumAction(courseId);
      if (result.success && result.data) {
        const mapped: ChapterView[] = result.data.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          lessons: chapter.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            videoUrl: lesson.videoUrl,
            sourceType: lesson.sourceType,
            isFree: lesson.isFree,
            isPublished: lesson.isPublished,
            type: lesson.videoUrl ? 'video' : 'text',
          })),
        }));
        setChapters(mapped);
      }
      setLoading(false);
    };

    fetchCurriculum();
  }, []);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    // Only handling chapter reorder for now
    if (result.type === 'chapter') {
      const items = Array.from(chapters);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      setChapters(items);
      const courseId = String(params.courseId);
      updateCurriculumOrderAction(courseId, items.map((item) => item.id));
    }
  };

  const addChapter = async () => {
    if (newChapterTitle.trim().length < 2) {
      showStatus('error', 'Tên chương cần ít nhất 2 ký tự.');
      return;
    }

    const courseId = String(params.courseId);
    const result = await createChapterAction(courseId, newChapterTitle.trim());
    if (!result.success || !result.chapter) {
      showStatus('error', result.message || 'Không tạo được chương.');
      return;
    }

    const chapter = result.chapter;

    setChapters((prev) => [
      ...prev,
      {
        id: chapter.id,
        title: chapter.title,
        lessons: [],
      },
    ]);
    setNewChapterTitle('');
    showStatus('success', 'Đã thêm chương mới.');
  };

  const addLesson = async (chapterId: string) => {
    const title = window.prompt('Nhap ten bai hoc moi');
    if (!title || title.trim().length < 2) return;

    const isFree = window.confirm('Danh dau bai hoc nay la mien phi?');
    const courseId = String(params.courseId);
    const result = await createLessonAction(courseId, chapterId, title.trim(), isFree);

    if (!result.success || !result.lesson) {
      showStatus('error', result.message || 'Không tạo được bài học.');
      return;
    }

    const lesson = result.lesson;

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lessons: [
                ...chapter.lessons,
                {
                  id: lesson.id,
                  title: lesson.title,
                  isFree: lesson.isFree,
                  isPublished: lesson.isPublished,
                  videoUrl: lesson.videoUrl,
                  sourceType: lesson.sourceType,
                  type: lesson.videoUrl ? 'video' : 'text',
                },
              ],
            }
          : chapter,
      ),
    );

    setSelectedLessonKey(`${chapterId}::${lesson.id}`);
    showStatus('success', 'Đã thêm bài học. Bạn có thể upload video hoặc gắn YouTube cho bài học vừa tạo.');
  };

  const createDemoObjectiveLessons = async () => {
    setIsCreatingDemoLessons(true);
    setStatusMessage('');

    try {
      const courseId = String(params.courseId);
      let targetChapter = chapters[0];

      if (!targetChapter) {
        const chapterResult = await createChapterAction(courseId, 'Chuong demo: Muc tieu khoa hoc');
        if (!chapterResult.success || !chapterResult.chapter) {
          showStatus('error', chapterResult.message || 'Không tạo được chương demo.');
          return;
        }

        targetChapter = {
          id: chapterResult.chapter.id,
          title: chapterResult.chapter.title,
          lessons: [],
        };

        setChapters([targetChapter]);
      }

      const demoTitles = ['Muc tieu 1: Lo trinh khoa hoc', 'Muc tieu 2: Ky nang dat duoc', 'Muc tieu 3: Du an thuc hanh'];
      const createdLessons: LessonView[] = [];

      for (let index = 0; index < demoTitles.length; index += 1) {
        const lessonResult = await createLessonAction(courseId, targetChapter.id, demoTitles[index], index === 0);
        if (!lessonResult.success || !lessonResult.lesson) {
          showStatus('error', lessonResult.message || 'Không tạo được đủ 3 bài học demo.');
          return;
        }

        createdLessons.push({
          id: lessonResult.lesson.id,
          title: lessonResult.lesson.title,
          videoUrl: lessonResult.lesson.videoUrl,
          sourceType: lessonResult.lesson.sourceType,
          isFree: lessonResult.lesson.isFree,
          isPublished: lessonResult.lesson.isPublished,
          type: lessonResult.lesson.videoUrl ? 'video' : 'text',
        });
      }

      setChapters((prev) =>
        prev.map((chapter) =>
          chapter.id === targetChapter?.id
            ? { ...chapter, lessons: [...chapter.lessons, ...createdLessons] }
            : chapter,
        ),
      );

      if (createdLessons[0]) {
        setSelectedLessonKey(`${targetChapter.id}::${createdLessons[0].id}`);
      }

      showStatus('success', 'Đã tạo 3 bài học mục tiêu demo.');
    } finally {
      setIsCreatingDemoLessons(false);
    }
  };

  const editChapter = async (chapterId: string, currentTitle: string) => {
    const nextTitle = window.prompt('Cap nhat ten chuong', currentTitle);
    if (!nextTitle || nextTitle.trim().length < 2) return;

    const courseId = String(params.courseId);
    const result = await updateChapterAction(courseId, chapterId, { title: nextTitle.trim() });

    if (!result.success || !result.chapter) {
      showStatus('error', result.message || 'Không cập nhật được chương.');
      return;
    }

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, title: result.chapter?.title || chapter.title }
          : chapter,
      ),
    );
    showStatus('success', 'Đã cập nhật chương.');
  };

  const removeChapter = async (chapterId: string) => {
    const shouldDelete = window.confirm('Ban co chac chan muon xoa chuong nay? Tat ca bai hoc ben trong se bi xoa.');
    if (!shouldDelete) return;

    const courseId = String(params.courseId);
    const result = await deleteChapterAction(courseId, chapterId);

    if (!result.success) {
      showStatus('error', result.message || 'Không xóa được chương.');
      return;
    }

    setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));

    if (selectedLesson && selectedLesson.chapterId === chapterId) {
      setSelectedLessonKey('');
      setYoutubeUrlInput('');
    }
    showStatus('success', 'Đã xóa chương.');
  };

  const removeLesson = async (chapterId: string, lessonId: string) => {
    const shouldDelete = window.confirm('Ban co chac chan muon xoa bai hoc nay?');
    if (!shouldDelete) return;

    const courseId = String(params.courseId);
    const result = await deleteLessonAction(courseId, chapterId, lessonId);

    if (!result.success) {
      showStatus('error', result.message || 'Không xóa được bài học.');
      return;
    }

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, lessons: chapter.lessons.filter((lesson) => lesson.id !== lessonId) }
          : chapter,
      ),
    );

    if (selectedLesson?.lessonId === lessonId) {
      setSelectedLessonKey('');
      setYoutubeUrlInput('');
    }
    showStatus('success', 'Đã xóa bài học.');
  };

  const uploadLessonVideo = async (chapterId: string, lessonId: string, file?: File | null) => {
    if (!file) return;

    const courseId = String(params.courseId);
    setUploadingLessonId(lessonId);

    try {
      const presigned = await requestLessonUploadAction({
        filename: file.name,
        mimeType: file.type || 'video/mp4',
        size: file.size,
        courseId,
        lessonId,
      });

      if (!presigned.success || !presigned.data) {
        showStatus('error', presigned.message || 'Không tạo được phiên upload video.');
        return;
      }

      if (presigned.data.uploadMethod === 'POST_FORM' && presigned.data.uploadFields) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(presigned.data.uploadFields)) {
          formData.append(key, value);
        }
        formData.append('file', file);

        const uploadResponse = await fetch(presigned.data.presignedUrl, {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          showStatus('error', 'Upload video thất bại.');
          return;
        }
      } else if (presigned.data.presignedUrl.includes('/api/upload/local/')) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadResponse = await fetch(presigned.data.presignedUrl, {
          method: 'PUT',
          body: formData,
        });
        if (!uploadResponse.ok) {
          showStatus('error', 'Upload video thất bại.');
          return;
        }
      } else {
        const uploadResponse = await fetch(presigned.data.presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadResponse.ok) {
          showStatus('error', 'Upload video thất bại.');
          return;
        }
      }

      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) {
        showStatus('error', confirmed.message || 'Không xác nhận được upload video.');
        return;
      }

      const updated = await updateLessonAction(courseId, chapterId, lessonId, {
        videoUrl: confirmed.data.url,
        sourceType: 'UPLOAD',
      });

      if (!updated.success || !updated.lesson) {
        showStatus('error', updated.message || 'Không cập nhật được bài học sau upload.');
        return;
      }

      setChapters((prev) =>
        prev.map((chapter) =>
          chapter.id !== chapterId
            ? chapter
            : {
                ...chapter,
                lessons: chapter.lessons.map((lesson) =>
                  lesson.id !== lessonId
                    ? lesson
                    : {
                        ...lesson,
                        videoUrl: updated.lesson?.videoUrl,
                        sourceType: updated.lesson?.sourceType || 'UPLOAD',
                        type: updated.lesson?.videoUrl ? 'video' : 'text',
                      },
                ),
              },
        ),
      );
      showStatus('success', 'Đã upload video cho bài học thành công.');
    } finally {
      setUploadingLessonId('');
    }
  };

  const attachYoutubeForSelectedLesson = async () => {
    if (!selectedLesson) {
      showStatus('error', 'Vui lòng chọn bài học mục tiêu trước khi gắn YouTube.');
      return;
    }

    if (!youtubeUrlInput.trim()) {
      showStatus('error', 'Vui lòng nhập URL YouTube.');
      return;
    }

    const courseId = String(params.courseId);
    const result = await updateLessonAction(courseId, selectedLesson.chapterId, selectedLesson.lessonId, {
      sourceType: 'YOUTUBE',
      videoUrl: youtubeUrlInput.trim(),
    });

    if (!result.success || !result.lesson) {
      showStatus('error', result.message || 'Không cập nhật được YouTube URL cho bài học.');
      return;
    }

    await registerYoutubeMediaAction({
      title: selectedLesson.lessonTitle,
      youtubeUrl: youtubeUrlInput.trim(),
      courseId,
      lessonId: selectedLesson.lessonId,
    });

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id !== selectedLesson.chapterId
          ? chapter
          : {
              ...chapter,
              lessons: chapter.lessons.map((lesson) =>
                lesson.id !== selectedLesson.lessonId
                  ? lesson
                  : {
                      ...lesson,
                      videoUrl: result.lesson?.videoUrl,
                      sourceType: 'YOUTUBE',
                      type: result.lesson?.videoUrl ? 'video' : 'text',
                      isPublished: Boolean(result.lesson?.isPublished),
                    },
              ),
            },
      ),
    );

    setYoutubeUrlInput('');
    showStatus('success', 'Đã gắn video YouTube cho bài học.');
  };

  const editLesson = async (
    chapterId: string,
    lessonId: string,
    currentTitle: string,
    currentUrl?: string | null,
    currentIsFree = false,
    currentSourceType: 'UPLOAD' | 'YOUTUBE' = 'UPLOAD',
  ) => {
    const nextTitle = window.prompt('Cap nhat ten bai hoc', currentTitle);
    if (!nextTitle || nextTitle.trim().length < 2) return;

    const isYoutube = window.confirm(
      `Nguon hien tai la ${currentSourceType}. Bam OK de dung YOUTUBE URL, Cancel de dung UPLOAD URL.`,
    );

    let nextVideoUrl = currentUrl || '';
    if (isYoutube) {
      const input = window.prompt('Nhap URL YouTube cho bai hoc', currentUrl || '');
      if (input === null) return;
      nextVideoUrl = input;
    } else {
      const input = window.prompt('Nhap URL video upload (co the de trong)', currentUrl || '');
      if (input === null) return;
      nextVideoUrl = input;
    }

    const nextIsFree = window.confirm(
      `Bai hoc nay ${currentIsFree ? 'dang' : 'chua'} la mien phi. Bam OK de dat MIEN PHI, Cancel de dat TINH PHI.`,
    );

    const courseId = String(params.courseId);
    const payload: { title: string; isFree: boolean; videoUrl?: string; sourceType: 'UPLOAD' | 'YOUTUBE' } = {
      title: nextTitle.trim(),
      isFree: nextIsFree,
      sourceType: isYoutube ? 'YOUTUBE' : 'UPLOAD',
    };

    if (nextVideoUrl.trim().length > 0) {
      payload.videoUrl = nextVideoUrl.trim();
    }

    const result = await updateLessonAction(courseId, chapterId, lessonId, payload);
    if (!result.success || !result.lesson) {
      showStatus('error', result.message || 'Không cập nhật được bài học.');
      return;
    }

    if (isYoutube && nextVideoUrl.trim().length > 0) {
      await registerYoutubeMediaAction({
        title: nextTitle.trim(),
        youtubeUrl: nextVideoUrl.trim(),
        courseId,
        lessonId,
      });
    }

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id !== chapterId
          ? chapter
          : {
              ...chapter,
              lessons: chapter.lessons.map((lesson) =>
                lesson.id !== lessonId
                  ? lesson
                  : {
                      ...lesson,
                      title: result.lesson?.title || lesson.title,
                      isFree: Boolean(result.lesson?.isFree),
                      videoUrl: result.lesson?.videoUrl,
                      sourceType: result.lesson?.sourceType || lesson.sourceType,
                      type: result.lesson?.videoUrl ? 'video' : 'text',
                      isPublished: Boolean(result.lesson?.isPublished),
                    },
              ),
            },
      ),
    );
    showStatus('success', 'Đã cập nhật bài học.');
  };

  const toggleLessonPublished = async (chapterId: string, lesson: LessonView) => {
    const courseId = String(params.courseId);
    const nextPublished = !lesson.isPublished;

    if (nextPublished && !lesson.videoUrl) {
      showStatus('error', 'Không thể publish bài học khi chưa có video URL.');
      return;
    }

    const result = await updateLessonAction(courseId, chapterId, lesson.id, {
      isPublished: nextPublished,
    });

    if (!result.success || !result.lesson) {
      showStatus('error', result.message || 'Không cập nhật được trạng thái bài học.');
      return;
    }

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id !== chapterId
          ? chapter
          : {
              ...chapter,
              lessons: chapter.lessons.map((item) =>
                item.id !== lesson.id ? item : { ...item, isPublished: Boolean(result.lesson?.isPublished) },
              ),
            },
      ),
    );

    showStatus('success', nextPublished ? 'Đã publish bài học.' : 'Đã ẩn bài học khỏi khóa học.');
  };

  if (!mounted) return null;
  if (loading) return <div className="p-8 text-muted-foreground">Đang tải giáo trình từ API...</div>;

  return (
    <div className="p-8">
      <Link href={`/instructor/courses/${params.courseId}`} className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại cài đặt
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Soạn giáo trình</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Kéo thả để sắp xếp chương và bài học theo logic của bạn.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newChapterTitle}
            onChange={(event) => setNewChapterTitle(event.target.value)}
            placeholder="Nhập tên chương mới..."
            className="w-64 bg-white"
          />
          <Button className="rounded-xl shadow-md font-bold px-6" onClick={addChapter}>
            <Plus className="mr-2 h-5 w-5" /> Thêm chương mới
          </Button>
          <Button
            variant="outline"
            className="rounded-xl font-bold"
            onClick={createDemoObjectiveLessons}
            disabled={isCreatingDemoLessons}
          >
            {isCreatingDemoLessons ? 'Đang tạo demo...' : 'Tạo 3 bài học mục tiêu demo'}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <StatusMessage type={statusType} message={statusMessage} />
      </div>

      <Card className="mb-8 rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Trung tâm upload video bài học</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Bài học mục tiêu</label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={selectedLessonKey}
              onChange={(event) => setSelectedLessonKey(event.target.value)}
            >
              <option value="">Chọn bài học</option>
              {allLessons.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.chapterTitle} - {item.lessonTitle}
                </option>
              ))}
            </select>
            {selectedLesson ? (
              <p className="text-xs font-semibold text-primary">Đang chọn: {selectedLesson.chapterTitle} - {selectedLesson.lessonTitle}</p>
            ) : (
              <p className="text-xs text-slate-500">Mẹo: Hãy thêm bài học trước, sau đó chọn bài học mục tiêu để upload/gắn YouTube.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Upload file video</label>
            <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary">
              <UploadCloud className="mr-2 size-4" /> Chọn file để tải lên
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                className="hidden"
                onChange={(event) => {
                  if (!selectedLesson) {
                    showStatus('error', 'Vui lòng chọn bài học trước khi upload video.');
                    event.currentTarget.value = '';
                    return;
                  }
                  const file = event.target.files?.[0];
                  uploadLessonVideo(selectedLesson.chapterId, selectedLesson.lessonId, file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {uploadingLessonId && (
              <p className="text-xs text-primary font-semibold">Đang upload video cho bài học...</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Gắn YouTube URL</label>
            <div className="flex gap-2">
              <Input
                value={youtubeUrlInput}
                onChange={(event) => setYoutubeUrlInput(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-white"
              />
              <Button variant="outline" onClick={attachYoutubeForSelectedLesson}>
                <Link2 className="mr-2 size-4" /> Gắn
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedLesson && (
        <Card className="mb-8 rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Chi tiết bài học đang chọn</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 font-semibold">Chương</p>
              <p className="font-bold text-slate-800">{selectedLesson.chapterTitle}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold">Tiêu đề bài học</p>
              <p className="font-bold text-slate-800">{selectedLesson.lessonTitle}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold">Nguồn</p>
              <p className="font-bold text-slate-800">{selectedLesson.lesson.sourceType}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold">Trạng thái</p>
              <p className="font-bold text-slate-800">{selectedLesson.lesson.isFree ? 'Miễn phí' : 'Trả phí'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-slate-500 font-semibold">Video</p>
              {selectedLesson.lesson.videoUrl ? (
                <div className="space-y-2">
                  {selectedLesson.lesson.sourceType === 'YOUTUBE' ? (
                    getYoutubeEmbedUrl(selectedLesson.lesson.videoUrl) ? (
                      <iframe
                        title={`youtube-${selectedLesson.lesson.id}`}
                        src={getYoutubeEmbedUrl(selectedLesson.lesson.videoUrl) || undefined}
                        className={`w-full rounded-xl border border-slate-200 ${isPreviewExpanded ? 'h-130' : 'h-75'}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <p className="text-slate-400">URL YouTube chưa đúng định dạng để nhúng video.</p>
                    )
                  ) : (
                    <video
                      controls
                      preload="metadata"
                      className={`w-full rounded-xl border border-slate-200 bg-black ${isPreviewExpanded ? 'h-130' : 'h-75'}`}
                      src={selectedLesson.lesson.videoUrl}
                    >
                      Trình duyệt không hỗ trợ phát video.
                    </video>
                  )}

                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPreviewExpanded((prev) => !prev)}
                    >
                      {isPreviewExpanded ? 'Thu nhỏ' : 'Phóng to'}
                    </Button>
                  </div>

                </div>
              ) : (
                <p className="text-slate-400">Chưa có URL video.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="max-w-4xl">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="chapters" type="chapter">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-6">
                
                {chapters.map((chapter, index) => (
                  <Draggable key={chapter.id} draggableId={chapter.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-3xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm transition-all ${snapshot.isDragging ? 'shadow-2xl shadow-primary/20 scale-[1.02] ring-2 ring-primary' : ''}`}
                      >
                        {/* Chapter Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-slate-50/50 rounded-t-3xl">
                           <div className="flex items-center gap-3">
                              <div {...provided.dragHandleProps} className="p-2 hover:bg-slate-200 rounded-md cursor-grab active:cursor-grabbing">
                                <GripVertical className="size-5 text-slate-400" />
                              </div>
                              <span className="font-bold text-lg">{chapter.title}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold text-primary hover:bg-primary/10"
                                onClick={() => editChapter(chapter.id, chapter.title)}
                              >
                                <Edit3 className="size-4 mr-1.5" /> Sửa
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold text-destructive hover:bg-destructive/10 px-2"
                                onClick={() => removeChapter(chapter.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                           </div>
                        </div>
                        
                        {/* Lessons List inside Chapter */}
                        <div className="p-4 space-y-3 bg-white/50">
                           {chapter.lessons.length === 0 ? (
                             <p className="text-sm font-medium text-slate-400 text-center py-4">Chưa có bài học nào trong phần này.</p>
                           ) : (
                             chapter.lessons.map((lesson) => (
                               <div
                                 key={lesson.id}
                                 className={`flex items-center justify-between p-3 rounded-xl border bg-white shadow-sm transition-colors group cursor-pointer ${
                                   selectedLessonKey === `${chapter.id}::${lesson.id}`
                                     ? 'border-primary ring-2 ring-primary/30'
                                     : 'border-slate-200 hover:border-primary/40'
                                 }`}
                                 onClick={() => setSelectedLessonKey(`${chapter.id}::${lesson.id}`)}
                               >
                                  <div className="flex items-center gap-3">
                                     <GripVertical className="size-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                                     <div className="p-1.5 rounded-md bg-slate-100 text-slate-500">
                                        {lesson.type === 'video' ? <Video className="size-4" /> : <AlignLeft className="size-4" />}
                                     </div>
                                     <span className="font-bold text-sm text-slate-700">{lesson.title}</span>
                                     <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${lesson.sourceType === 'YOUTUBE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                       {lesson.sourceType}
                                     </span>
                                     <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${lesson.isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                       {lesson.isFree ? 'FREE' : 'PAID'}
                                     </span>
                                     <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${lesson.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                                       {lesson.isPublished ? 'PUBLISHED' : 'DRAFT'}
                                     </span>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-8 px-2 text-[11px] font-semibold ${lesson.isPublished ? 'text-amber-700 hover:text-amber-800' : 'text-emerald-700 hover:text-emerald-800'}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleLessonPublished(chapter.id, lesson);
                                      }}
                                    >
                                      {lesson.isPublished ? 'Unpublish' : 'Publish'}
                                    </Button>
                                    <label className="inline-flex">
                                      <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                                        className="hidden"
                                        onChange={(event) => {
                                          event.stopPropagation();
                                          const file = event.target.files?.[0];
                                          setSelectedLessonKey(`${chapter.id}::${lesson.id}`);
                                          uploadLessonVideo(chapter.id, lesson.id, file);
                                          event.currentTarget.value = '';
                                        }}
                                      />
                                      <span className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-500 hover:border-primary hover:text-primary cursor-pointer">
                                        {uploadingLessonId === lesson.id ? 'Dang upload...' : 'Upload'}
                                      </span>
                                    </label>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-primary"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        editLesson(chapter.id, lesson.id, lesson.title, lesson.videoUrl, lesson.isFree, lesson.sourceType);
                                      }}
                                    >
                                      <Edit3 className="size-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-destructive"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        removeLesson(chapter.id, lesson.id);
                                      }}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                               </div>
                             ))
                           )}

                           <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg w-full border-dashed border-2 py-5 font-bold text-slate-500 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                                onClick={() => addLesson(chapter.id)}
                              >
                                <Plus className="size-4 mr-2" /> Thêm Bài Học
                              </Button>
                           </div>
                        </div>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
