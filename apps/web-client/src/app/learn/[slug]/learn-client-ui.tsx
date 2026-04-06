'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { CheckCircle2, Circle, ChevronLeft, Menu, PlayCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateLessonProgressAction } from '@/app/actions/student';
import { getLessonPlaybackAction } from '@/app/actions/instructor';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LearnClientUI({ course, initialProgress }: { course: any, initialProgress: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [progresses, setProgresses] = useState<any[]>(initialProgress);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Determine current lesson
  const urlLessonId = searchParams.get('lessonId');
  const allLessons = useMemo(() => {
    const lessons: any[] = [];
    course.chapters.forEach((ch: any) => {
      ch.lessons.forEach((l: any) => lessons.push({ ...l, chapterTitle: ch.title }));
    });
    return lessons;
  }, [course]);

  // Default to first lesson if not in URL
  const currentLesson = useMemo(() => {
    if (urlLessonId) return allLessons.find((l) => l.id === urlLessonId) || allLessons[0];
    return allLessons[0];
  }, [urlLessonId, allLessons]);

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    if (!currentLesson) return;
    
    let isMounted = true;
    const fetchVideoUrl = async () => {
      setVideoLoading(true);
      setActiveVideoUrl(null);
      const res = await getLessonPlaybackAction(currentLesson.id, false);
      if (isMounted) {
        if (res.success && res.data?.videoUrl) {
           setActiveVideoUrl(res.data.videoUrl);
        }
        setVideoLoading(false);
      }
    };

    fetchVideoUrl();
    return () => { isMounted = false; };
  }, [currentLesson?.id]);

  // Compute metrics
  const completedCount = progresses.filter((p) => p.isCompleted).length;
  const progressPercent = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  // Handle Video Completion
  const handleMarkCompleted = async () => {
    if (!currentLesson) return;
    const isCurrentlyDone = progresses.find((p) => p.lessonId === currentLesson.id)?.isCompleted;
    if (isCurrentlyDone) return;

    // Optimistic UI update
    setProgresses((prev) => {
      const idx = prev.findIndex((p) => p.lessonId === currentLesson.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx].isCompleted = true;
        return newArr;
      }
      return [...prev, { lessonId: currentLesson.id, isCompleted: true, lastWatched: 0 }];
    });

    // Call API
    await updateLessonProgressAction(currentLesson.id, true, 0);
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      if (url.includes('youtube.com/watch')) {
        const params = new URL(url).searchParams;
        return `https://www.youtube.com/embed/${params.get('v')}`;
      }
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1];
        return `https://www.youtube.com/embed/${id}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 z-20 ${isSidebarOpen ? 'w-80' : 'w-0 hidden md:flex md:w-80'}`}>
        <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <Link href={`/courses/${course.slug}`} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Về trang khóa học
          </Link>
          <h2 className="font-bold text-slate-800 leading-tight mb-3">{course.title}</h2>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-500">
              <span>Tiến độ học tập</span>
              <span className="text-primary">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {course.chapters.map((chapter: any, chIdx: number) => (
              <div key={chapter.id} className="space-y-1">
                <h3 className="text-xs font-black uppercase text-slate-400 px-2 py-1 tracking-wider">
                  Chương {chIdx + 1}: {chapter.title}
                </h3>
                <div className="space-y-0.5">
                  {chapter.lessons.map((lesson: any) => {
                    const isDone = progresses.find((p) => p.lessonId === lesson.id)?.isCompleted;
                    const isSelected = currentLesson?.id === lesson.id;
                    
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => router.push(`${pathname}?lessonId=${lesson.id}`)}
                        className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg transition-all ${
                          isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-emerald-500'}`} />
                          ) : (
                            <Circle className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-slate-300'}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold line-clamp-2 ${isSelected ? 'text-primary' : 'text-slate-700'}`}>
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {lesson.duration ? `${Math.ceil(lesson.duration / 60)} phút` : 'Video'}
                            </span>
                            {isSelected && <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded animate-pulse">Đang học</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
        <header className="h-14 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center px-4 sticky top-0 z-10">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="-ml-2 mr-2">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="text-sm font-semibold text-slate-500 hidden sm:inline-block">
            {currentLesson?.chapterTitle}
          </span>
          <span className="mx-2 text-slate-300 hidden sm:inline-block">/</span>
          <span className="text-sm font-bold text-slate-800 line-clamp-1">
            {currentLesson?.title}
          </span>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-5xl mx-auto w-full p-4 md:p-6 pb-20">
            {currentLesson ? (
              <div className="space-y-6">
                {/* Video Player Area */}
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-slate-800 relative group">
                  {videoLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                      <Loader2 className="w-12 h-12 opacity-50 animate-spin" />
                      <p className="text-sm font-semibold uppercase tracking-widest opacity-50">Đang tải video...</p>
                    </div>
                  ) : activeVideoUrl ? (
                    activeVideoUrl.includes('youtube') || activeVideoUrl.includes('youtu.be') ? (
                       <iframe 
                        src={getYoutubeEmbedUrl(activeVideoUrl)} 
                        className="w-full h-full" 
                        allowFullScreen 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    ) : (
                      <video 
                        src={activeVideoUrl} 
                        className="w-full h-full object-contain" 
                        controls 
                        controlsList="nodownload"
                        onEnded={handleMarkCompleted}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                      <PlayCircle className="w-12 h-12 opacity-50" />
                      <p className="text-sm font-semibold uppercase tracking-widest opacity-50">Video Error</p>
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900 mb-2">{currentLesson.title}</h1>
                      <div className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed">
                        {currentLesson.content || 'Bài học này hiện chưa có tài liệu đính kèm.'}
                      </div>
                    </div>
                    <Button 
                      onClick={handleMarkCompleted} 
                      variant={progresses.find(p => p.lessonId === currentLesson.id)?.isCompleted ? "secondary" : "default"}
                    >
                      {progresses.find(p => p.lessonId === currentLesson.id)?.isCompleted ? (
                        <><CheckCircle2 className="w-4 h-4 mr-2" /> Đã hoàn thành</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 mr-2" /> Đánh dấu hoàn thành</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p>Đang tải bài học...</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
