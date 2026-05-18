'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, FileEdit, List, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusMessage } from '@/components/ui/status-message';
import {
  getCourseByIdAction,
  getCourseCurriculumAction,
  type CourseDto,
  type CourseCurriculumDto,
  type ChapterDto,
  type LessonDto,
} from '@/app/actions/instructor';

interface LessonSelection {
  chapterTitle: string;
  lesson: LessonDto;
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

export default function InstructorCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = String(params.courseId);

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [curriculum, setCurriculum] = useState<CourseCurriculumDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const lessons = useMemo(() => {
    if (!curriculum) return [] as LessonSelection[];

    return curriculum.chapters.flatMap((chapter: ChapterDto) =>
      chapter.lessons.map((lesson: LessonDto) => ({
        chapterTitle: chapter.title,
        lesson,
      })),
    );
  }, [curriculum]);

  const selected = useMemo(
    () => lessons.find((item) => item.lesson.id === selectedLessonId) || lessons[0] || null,
    [lessons, selectedLessonId],
  );

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      const [courseResult, curriculumResult] = await Promise.all([
        getCourseByIdAction(courseId),
        getCourseCurriculumAction(courseId),
      ]);

      if (!courseResult.success || !courseResult.data) {
        setStatusType('error');
        setStatusMessage(courseResult.message || 'Không tải được thông tin khóa học.');
        setLoading(false);
        return;
      }

      if (!curriculumResult.success || !curriculumResult.data) {
        setStatusType('error');
        setStatusMessage(curriculumResult.message || 'Không tải được giáo trình khóa học.');
        setLoading(false);
        return;
      }

      setCourse(courseResult.data);
      setCurriculum(curriculumResult.data);
      const firstLesson = curriculumResult.data.chapters.flatMap((chapter) => chapter.lessons)[0];
      setSelectedLessonId(firstLesson?.id || '');
      setLoading(false);
    };

    fetchDetail();
  }, [courseId]);

  useEffect(() => {
    setIsPreviewExpanded(false);
  }, [selectedLessonId]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Đang tải chi tiết khóa học...</div>;
  }

  if (!course || !curriculum) {
    return (
      <div className="p-8">
        <StatusMessage type="error" message={statusMessage || 'Không tìm thấy khóa học.'} />
      </div>
    );
  }

  const totalLessons = lessons.length;
  const publishedLessons = lessons.filter((l) => l.lesson.isPublished).length;
  const previewLesson = lessons.find((l) => l.lesson.isFree);
  const hasChapters = (curriculum?.chapters?.length ?? 0) > 0;

  const checklist = [
    {
      label: 'Có tiêu đề khóa học',
      ok: !!course.title?.trim(),
      action: !course.title?.trim() ? 'Nhấn "Cấu hình" để thêm tiêu đề' : undefined,
    },
    {
      label: 'Có mô tả khóa học',
      ok: !!course.description?.trim(),
      action: !course.description?.trim() ? 'Nhấn "Cấu hình" để thêm mô tả' : undefined,
    },
    {
      label: 'Có thumbnail khóa học',
      ok: !!course.thumbnail,
      action: !course.thumbnail ? 'Nhấn "Cấu hình" để tải lên thumbnail' : undefined,
    },
    {
      label: 'Có ít nhất 1 chương',
      ok: hasChapters,
      action: !hasChapters ? 'Nhấn "Chương trình" để tạo chương' : undefined,
    },
    {
      label: 'Có ít nhất 1 bài học đã xuất bản',
      ok: publishedLessons > 0,
      action: publishedLessons === 0 ? 'Nhấn "Chương trình" để xuất bản bài học' : undefined,
    },
    {
      label: 'Có ít nhất 1 bài học xem trước (free)',
      ok: !!previewLesson,
      action: !previewLesson ? 'Nhấn "Chương trình" để đánh dấu 1 bài miễn phí' : undefined,
    },
    {
      label: 'Khóa học có giá hợp lệ',
      ok: course.price > 0,
      action: course.price <= 0 ? 'Nhấn "Cấu hình" để đặt giá' : undefined,
    },
    {
      label: 'Có thể xem trước khóa học',
      ok: !!previewLesson?.lesson.videoUrl || !!previewLesson?.lesson.content?.trim(),
      action: 'Kiểm tra bài học free có video hoặc n�™i dung',
    },
  ];

  const passCount = checklist.filter((c) => c.ok).length;
  const allPass = passCount === checklist.length;

  return (
    <div className="p-8 space-y-6">
      <Link href="/instructor/courses" className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại danh sách
      </Link>

      {statusMessage && <StatusMessage type={statusType} message={statusMessage} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="workspace-page-title">{course.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Trang chi tiết đầy đủ dành cho giảng viên.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push(`/instructor/courses/${courseId}?step=2`)}>
            <FileEdit className="w-4 h-4 mr-2" /> Cấu hình
          </Button>
          <Button variant="outline" onClick={() => router.push(`/instructor/courses/${courseId}?step=3`)}>
            <List className="w-4 h-4 mr-2" /> Chương trình
          </Button>
        </div>
      </div>

      <div
        className={`rounded-2xl border p-5 ${
          allPass
            ? 'border-green-200 bg-green-50'
            : passCount >= checklist.length - 2
            ? 'border-amber-200 bg-amber-50'
            : 'border-red-100 bg-red-50/50'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`font-bold text-base ${allPass ? 'text-green-800' : 'text-amber-800'}`}>
              Kiểm tra sẵn sàng xuất bản
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {passCount}/{checklist.length} điều kiện đã đạt
            </p>
          </div>
          {allPass ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sẵn sàng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              <XCircle className="w-3.5 h-3.5" />
              Cần bổ sung
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {checklist.map((item, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${item.ok ? 'bg-white/60' : 'bg-white/80'}`}>
              {item.ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <span className={item.ok ? 'text-green-800 font-medium' : 'text-red-700'}>
                {item.label}
                {item.action && (
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">{item.action}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle>Thông tin khóa học</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 font-semibold">Trạng thái</p>
                <p className="font-bold">{course.status || 'DRAFT'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Level</p>
                <p className="font-bold">{course.level}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Giá</p>
                <p className="font-bold">{Number(course.price).toLocaleString('vi-VN')} đ</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Tổng bài học</p>
                <p className="font-bold">{totalLessons}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Ngày tạo</p>
                <p className="font-bold">{new Date(course.createdAt).toLocaleString('vi-VN')}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Cập nhật gần nhất</p>
                <p className="font-bold">{course.updatedAt ? new Date(course.updatedAt).toLocaleString('vi-VN') : '-'}</p>
              </div>
            </div>

            <div>
              <p className="text-slate-500 font-semibold">Mô tả</p>
              <p className="font-medium text-slate-700 whitespace-pre-line">{course.description || 'Chưa có mô tả.'}</p>
            </div>

            {course.thumbnail ? (
              <div>
                <p className="text-slate-500 font-semibold mb-2">Thumbnail</p>
                <Image src={course.thumbnail} alt="thumbnail" width={1280} height={720} className="w-full max-h-85 rounded-xl object-cover border border-slate-200" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="w-4 h-4" /> Danh sách bài học</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-155 overflow-auto">
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bài học nào.</p>
            ) : (
              lessons.map((item) => (
                <button
                  key={item.lesson.id}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${selected?.lesson.id === item.lesson.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/40'}`}
                  onClick={() => setSelectedLessonId(item.lesson.id)}
                >
                  <p className="text-xs text-slate-500 font-semibold">{item.chapterTitle}</p>
                  <p className="font-bold text-sm text-slate-800">{item.lesson.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{item.lesson.sourceType} • {item.lesson.isPublished ? 'PUBLISHED' : 'DRAFT'} • {item.lesson.isFree ? 'FREE' : 'PAID'}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle>Video bài học</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selected ? (
            <p className="text-muted-foreground">Chưa chọn bài học.</p>
          ) : !selected.lesson.videoUrl ? (
            <p className="text-muted-foreground">Bài học chưa có video URL.</p>
          ) : selected.lesson.sourceType === 'YOUTUBE' ? (
            getYoutubeEmbedUrl(selected.lesson.videoUrl) ? (
              <iframe
                title={`preview-${selected.lesson.id}`}
                src={getYoutubeEmbedUrl(selected.lesson.videoUrl) || undefined}
                className={`w-full rounded-xl border border-slate-200 ${isPreviewExpanded ? 'h-130' : 'h-75'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <p className="text-muted-foreground">URL YouTube chưa đúng định dạng để nhúng.</p>
            )
          ) : (
            <video
              controls
              preload="metadata"
              className={`w-full rounded-xl border border-slate-200 bg-black ${isPreviewExpanded ? 'h-130' : 'h-75'}`}
              src={selected.lesson.videoUrl}
            >
              Trình duyệt không hỗ trợ phát video.
            </video>
          )}

          {selected?.lesson.videoUrl ? (
            <Button variant="outline" size="sm" onClick={() => setIsPreviewExpanded((prev) => !prev)}>
              {isPreviewExpanded ? 'Thu nhỏ' : 'Phóng to'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

