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
        setStatusMessage(courseResult.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c thÃ´ng tin khÃ³a há»c.');
        setLoading(false);
        return;
      }

      if (!curriculumResult.success || !curriculumResult.data) {
        setStatusType('error');
        setStatusMessage(curriculumResult.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c giÃ¡o trÃ¬nh khÃ³a há»c.');
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
    return <div className="p-8 text-muted-foreground">Äang táº£i chi tiáº¿t khÃ³a há»c...</div>;
  }

  if (!course || !curriculum) {
    return (
      <div className="p-8">
        <StatusMessage type="error" message={statusMessage || 'KhÃ´ng tÃ¬m tháº¥y khÃ³a há»c.'} />
      </div>
    );
  }

  const totalLessons = lessons.length;
  const publishedLessons = lessons.filter((l) => l.lesson.isPublished).length;
  const previewLesson = lessons.find((l) => l.lesson.isFree);
  const hasChapters = (curriculum?.chapters?.length ?? 0) > 0;

  const checklist = [
    {
      label: 'CÃ³ tiÃªu Ä‘á» khÃ³a há»c',
      ok: !!course.title?.trim(),
      action: !course.title?.trim() ? 'Nháº¥n "Cáº¥u hÃ¬nh" Ä‘á»ƒ thÃªm tiÃªu Ä‘á»' : undefined,
    },
    {
      label: 'CÃ³ mÃ´ táº£ khÃ³a há»c',
      ok: !!course.description?.trim(),
      action: !course.description?.trim() ? 'Nháº¥n "Cáº¥u hÃ¬nh" Ä‘á»ƒ thÃªm mÃ´ táº£' : undefined,
    },
    {
      label: 'CÃ³ thumbnail khÃ³a há»c',
      ok: !!course.thumbnail,
      action: !course.thumbnail ? 'Nháº¥n "Cáº¥u hÃ¬nh" Ä‘á»ƒ táº£i lÃªn thumbnail' : undefined,
    },
    {
      label: 'CÃ³ Ã­t nháº¥t 1 chÆ°Æ¡ng',
      ok: hasChapters,
      action: !hasChapters ? 'Nháº¥n "ChÆ°Æ¡ng trÃ¬nh" Ä‘á»ƒ táº¡o chÆ°Æ¡ng' : undefined,
    },
    {
      label: 'CÃ³ Ã­t nháº¥t 1 bÃ i há»c Ä‘Ã£ xuáº¥t báº£n',
      ok: publishedLessons > 0,
      action: publishedLessons === 0 ? 'Nháº¥n "ChÆ°Æ¡ng trÃ¬nh" Ä‘á»ƒ xuáº¥t báº£n bÃ i há»c' : undefined,
    },
    {
      label: 'CÃ³ Ã­t nháº¥t 1 bÃ i há»c xem trÆ°á»›c (free)',
      ok: !!previewLesson,
      action: !previewLesson ? 'Nháº¥n "ChÆ°Æ¡ng trÃ¬nh" Ä‘á»ƒ Ä‘Ã¡nh dáº¥u 1 bÃ i miá»…n phÃ­' : undefined,
    },
    {
      label: 'KhÃ³a há»c cÃ³ giÃ¡ há»£p lá»‡',
      ok: course.price > 0,
      action: course.price <= 0 ? 'Nháº¥n "Cáº¥u hÃ¬nh" Ä‘á»ƒ Ä‘áº·t giÃ¡' : undefined,
    },
    {
      label: 'CÃ³ thá»ƒ xem trÆ°á»›c khÃ³a há»c',
      ok: !!previewLesson?.lesson.videoUrl || !!previewLesson?.lesson.content?.trim(),
      action: 'Kiá»ƒm tra bÃ i há»c free cÃ³ video hoáº·c ná»™i dung',
    },
  ];

  const passCount = checklist.filter((c) => c.ok).length;
  const allPass = passCount === checklist.length;

  return (
    <div className="p-8 space-y-6">
      <Link href="/instructor/courses" className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay láº¡i danh sÃ¡ch
      </Link>

      {statusMessage && <StatusMessage type={statusType} message={statusMessage} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="workspace-page-title">{course.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Trang chi tiáº¿t Ä‘áº§y Ä‘á»§ dÃ nh cho giáº£ng viÃªn.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push(`/instructor/courses/${courseId}?step=2`)}>
            <FileEdit className="w-4 h-4 mr-2" /> Cáº¥u hÃ¬nh
          </Button>
          <Button variant="outline" onClick={() => router.push(`/instructor/courses/${courseId}?step=3`)}>
            <List className="w-4 h-4 mr-2" /> ChÆ°Æ¡ng trÃ¬nh
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
              Kiá»ƒm tra sáºµn sÃ ng xuáº¥t báº£n
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {passCount}/{checklist.length} Ä‘iá»u kiá»‡n Ä‘Ã£ Ä‘áº¡t
            </p>
          </div>
          {allPass ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sáºµn sÃ ng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
              <XCircle className="w-3.5 h-3.5" />
              Cáº§n bá»• sung
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
            <CardTitle>ThÃ´ng tin khÃ³a há»c</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 font-semibold">Tráº¡ng thÃ¡i</p>
                <p className="font-bold">{course.status || 'DRAFT'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Level</p>
                <p className="font-bold">{course.level}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">GiÃ¡</p>
                <p className="font-bold">{Number(course.price).toLocaleString('vi-VN')} Ä‘</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Tá»•ng bÃ i há»c</p>
                <p className="font-bold">{totalLessons}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">NgÃ y táº¡o</p>
                <p className="font-bold">{new Date(course.createdAt).toLocaleString('vi-VN')}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Cáº­p nháº­t gáº§n nháº¥t</p>
                <p className="font-bold">{course.updatedAt ? new Date(course.updatedAt).toLocaleString('vi-VN') : '-'}</p>
              </div>
            </div>

            <div>
              <p className="text-slate-500 font-semibold">MÃ´ táº£</p>
              <p className="font-medium text-slate-700 whitespace-pre-line">{course.description || 'ChÆ°a cÃ³ mÃ´ táº£.'}</p>
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
            <CardTitle className="flex items-center gap-2"><Eye className="w-4 h-4" /> Danh sÃ¡ch bÃ i há»c</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-155 overflow-auto">
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">ChÆ°a cÃ³ bÃ i há»c nÃ o.</p>
            ) : (
              lessons.map((item) => (
                <button
                  key={item.lesson.id}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${selected?.lesson.id === item.lesson.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/40'}`}
                  onClick={() => setSelectedLessonId(item.lesson.id)}
                >
                  <p className="text-xs text-slate-500 font-semibold">{item.chapterTitle}</p>
                  <p className="font-bold text-sm text-slate-800">{item.lesson.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{item.lesson.sourceType} â€¢ {item.lesson.isPublished ? 'PUBLISHED' : 'DRAFT'} â€¢ {item.lesson.isFree ? 'FREE' : 'PAID'}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle>Video bÃ i há»c</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selected ? (
            <p className="text-muted-foreground">ChÆ°a chá»n bÃ i há»c.</p>
          ) : !selected.lesson.videoUrl ? (
            <p className="text-muted-foreground">BÃ i há»c chÆ°a cÃ³ video URL.</p>
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
              <p className="text-muted-foreground">URL YouTube chÆ°a Ä‘Ãºng Ä‘á»‹nh dáº¡ng Ä‘á»ƒ nhÃºng.</p>
            )
          ) : (
            <video
              controls
              preload="metadata"
              className={`w-full rounded-xl border border-slate-200 bg-black ${isPreviewExpanded ? 'h-130' : 'h-75'}`}
              src={selected.lesson.videoUrl}
            >
              TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ phÃ¡t video.
            </video>
          )}

          {selected?.lesson.videoUrl ? (
            <Button variant="outline" size="sm" onClick={() => setIsPreviewExpanded((prev) => !prev)}>
              {isPreviewExpanded ? 'Thu nhá»' : 'PhÃ³ng to'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

