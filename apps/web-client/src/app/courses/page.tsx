'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Search, Filter, Star, Clock, User, ChevronRight, PlayCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import {
  getPublicCoursesAction,
  getPublicCourseDetailAction,
  getLessonPlaybackAction,
  type CourseDto,
  type CourseCurriculumDto,
} from '@/app/actions/instructor';

interface CourseCardView {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  price: string;
  originalPrice: string;
  rating: number;
  reviews: number;
  duration: string;
  students: string;
  thumbnail: string;
  badge: string;
}

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseCardView[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseCurriculumDto | null>(null);
  const [selectedLessonTitle, setSelectedLessonTitle] = useState<string>('');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>('');
  const [playbackError, setPlaybackError] = useState<string>('');
  const [playingLessonId, setPlayingLessonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      const result = await getPublicCoursesAction(1, 12);
      if (!result.success || !result.data) {
        setCourses([]);
        setLoading(false);
        return;
      }

      const mapped = result.data.courses.map((course: CourseDto): CourseCardView => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        instructor: course.instructorId,
        price: `${Number(course.price).toLocaleString('vi-VN')}đ`,
        originalPrice: '',
        rating: 4.8,
        reviews: 0,
        duration: `${Math.max(1, Math.floor(course.totalDuration / 3600))} giờ`,
        students: `${course._count?.enrollments ?? 0}`,
        thumbnail: (course.title.match(/[A-Za-z]/g)?.slice(0, 3).join('') || 'CRS').toUpperCase(),
        badge: course.status === 'PUBLISHED' ? 'Published' : '',
      }));

      setCourses(mapped);
      setLoading(false);
    };

    fetchCourses();
  }, []);

  const openCourseDetail = async (slug: string) => {
    setDetailLoading(true);
    const result = await getPublicCourseDetailAction(slug);
    if (!result.success || !result.data) {
      setSelectedCourse(null);
      setSelectedLessonTitle('');
      setSelectedVideoUrl('');
      setPlayingLessonId('');
      setPlaybackError('Không tải được chi tiết khóa học. Vui lòng thử lại.');
      setDetailLoading(false);
      return;
    }

    setSelectedCourse(result.data);

    // Tu dong chon bai free dau tien co video de test luong hoc vien xem noi dung mien phi
    const firstFreeWithVideo = result.data.chapters
      .flatMap((chapter) => chapter.lessons)
      .find((lesson) => lesson.isFree && lesson.videoUrl);

    if (firstFreeWithVideo) {
      const playback = await getLessonPlaybackAction(firstFreeWithVideo.id, false);
      if (playback.success && playback.data?.videoUrl) {
        setSelectedLessonTitle(firstFreeWithVideo.title);
        setSelectedVideoUrl(playback.data.videoUrl);
        setPlayingLessonId(firstFreeWithVideo.id);
        setPlaybackError('');
      } else {
        setSelectedLessonTitle('');
        setSelectedVideoUrl('');
        setPlayingLessonId('');
        setPlaybackError('Khóa học chưa có bài miễn phí sẵn sàng phát.');
      }
    } else {
      setSelectedLessonTitle('');
      setSelectedVideoUrl('');
      setPlayingLessonId('');
      setPlaybackError('Khóa học chưa có bài miễn phí để học thử.');
    }
    setDetailLoading(false);
  };

  return (
    <div className="glass-page min-h-screen text-foreground pb-24 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-10%] w-[35%] h-[40%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      {/* Hero Section */}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 relative z-10 space-y-12">
        <ScrollReveal>
          <div className="flex flex-col items-center text-center space-y-6 pt-10 pb-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance">
              Khám Phá <span className="text-primary">Lộ Trình</span> Của Bạn
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl font-medium">
              Hơn 500+ dự án thực chiến và khóa học chất lượng cao được dẫn dắt bởi các chuyên gia công nghệ hàng đầu.
            </p>
            
            {/* Search Bar */}
            <div className="w-full max-w-2xl flex items-center bg-white/60 backdrop-blur-md border border-white/80 rounded-full p-2 shadow-xl shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
              <Search className="w-6 h-6 text-muted-foreground ml-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Tìm kiếm khoá học (VD: React, Node.js, Kubernetes...)" 
                className="flex-1 bg-transparent border-none outline-none px-4 text-base font-medium placeholder:text-muted-foreground"
              />
              <Button className="rounded-full px-6 h-12 font-bold shadow-md shrink-0">
                Tìm Kiếm
              </Button>
            </div>
          </div>
        </ScrollReveal>

        {/* Filter & Categories */}
        <ScrollReveal delay={150}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide">
              {['Tất cả', 'Web Backend', 'Web Frontend', 'DevOps', 'System Design', 'Mobile'].map((cat, idx) => (
                <Button key={idx} variant={idx === 0 ? 'default' : 'outline'} className={`rounded-xl px-5 whitespace-nowrap font-bold ${idx !== 0 ? 'bg-white/50 border-white/60 hover:bg-white/80' : 'shadow-md shadow-primary/20'}`}>
                  {cat}
                </Button>
              ))}
            </div>
            
            <Button variant="outline" className="rounded-xl px-5 font-bold bg-white/50 border-white/60 hover:bg-white/80 shrink-0">
              <Filter className="w-4 h-4 mr-2" />
              Lọc kết quả
            </Button>
          </div>
        </ScrollReveal>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
          {loading && <p className="col-span-full text-center text-muted-foreground">Đang tải khóa học...</p>}

          {!loading && courses.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground">Chưa có dữ liệu khóa học từ API.</p>
          )}

          {!loading && courses.map((course, idx) => (
            <ScrollReveal key={course.id} delay={idx * 100}>
              <button
                type="button"
                className="block h-full w-full text-left"
                onClick={() => openCourseDetail(course.slug)}
              >
              <div className="glass-panel group rounded-4xl border-white/60 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 transition-all duration-300 flex flex-col overflow-hidden relative cursor-pointer h-full">
                
                {/* Thumbnail */}
                <div className="relative aspect-video bg-[linear-gradient(135deg,hsl(var(--primary)/0.1),hsl(var(--primary)/0.02))] border-b border-white/50 flex items-center justify-center overflow-hidden">
                  <span className="text-6xl font-black text-primary/20 tracking-tighter group-hover:scale-110 transition-transform duration-500">
                    {course.thumbnail}
                  </span>
                  
                  {/* Badge */}
                  {course.badge && (
                     <span className="absolute top-4 left-4 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8))] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                       {course.badge}
                     </span>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                     <div className="size-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-2xl">
                       <div className="w-0 h-0 border-t-8 border-t-transparent border-l-14 border-l-white border-b-8 border-b-transparent ml-1" />
                     </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-bold leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-1.5">
                    <User className="w-4 h-4" /> {course.instructor}
                  </p>

                  <div className="flex items-center gap-1 mb-6">
                    <span className="text-amber-500 font-bold">{course.rating}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`w-4 h-4 ${star <= Math.floor(course.rating) ? 'fill-amber-500 text-amber-500' : 'fill-muted text-muted'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">({course.reviews})</span>
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pt-4 border-t border-border/40">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {course.duration}</span>
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {course.students}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col">
                        <span className="text-xl font-black text-primary">{course.price}</span>
                        {course.originalPrice && (
                           <span className="text-xs font-semibold text-muted-foreground line-through decoration-muted-foreground/50">{course.originalPrice}</span>
                        )}
                      </div>
                      <Button asChild variant="ghost" className="rounded-full size-10 p-0 text-primary hover:bg-primary/10">
                        <Link href={`/courses/${course.slug}`} aria-label={`Xem chi tiết ${course.title}`}>
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  
                </div>

              </div>
              </button>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={250}>
          <section className="mt-10 rounded-3xl border border-white/60 bg-white/60 backdrop-blur-xl p-6 md:p-8 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Chi tiết khóa học và bài học miễn phí</h2>
                <p className="text-sm text-muted-foreground font-medium mt-1">
                  Chọn một khóa học để kiểm tra đầy đủ luồng học viên xem video trước khi mở thanh toán.
                </p>
              </div>
            </div>

            {detailLoading && <p className="mt-6 text-sm text-muted-foreground">Đang tải chi tiết khóa học...</p>}

            {!detailLoading && !selectedCourse && (
              <p className="mt-6 text-sm text-muted-foreground">Chưa chọn khóa học. Bấm vào một card ở trên để xem nội dung.</p>
            )}

            {!detailLoading && selectedCourse && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xl font-bold">{selectedCourse.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedCourse.description || 'Không có mô tả'}</p>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    {selectedVideoUrl ? (
                      getYoutubeEmbedUrl(selectedVideoUrl) ? (
                        <iframe
                          className="w-full aspect-video rounded-xl"
                          src={getYoutubeEmbedUrl(selectedVideoUrl) || ''}
                          title={selectedLessonTitle || 'Free preview'}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video className="w-full aspect-video rounded-xl bg-black" controls src={selectedVideoUrl} />
                      )
                    ) : (
                      <div className="aspect-video rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col gap-2 items-center justify-center text-sm text-slate-500">
                        <PlayCircle className="size-7" />
                        <span>{playbackError || 'Khóa học này chưa có video để phát.'}</span>
                      </div>
                    )}
                  </div>

                  {selectedLessonTitle && (
                    <p className="text-sm font-semibold text-primary">Đang xem: {selectedLessonTitle}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700">Danh sách bài học</h4>
                  {selectedCourse.chapters.map((chapter) => (
                    <div key={chapter.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-sm font-bold mb-2">{chapter.title}</p>
                      <div className="space-y-2">
                        {chapter.lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            type="button"
                            className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            onClick={async () => {
                              if (!lesson.isFree) {
                                setPlaybackError('Bài học trả phí. Bạn cần đăng ký khóa học để xem.');
                                return;
                              }
                              const playback = await getLessonPlaybackAction(lesson.id, false);
                              if (!playback.success || !playback.data?.videoUrl) {
                                setPlaybackError(playback.message || 'Không phát được video bài học này.');
                                return;
                              }
                              setSelectedLessonTitle(lesson.title);
                              setSelectedVideoUrl(playback.data.videoUrl);
                              setPlayingLessonId(lesson.id);
                              setPlaybackError('');
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className={`text-sm font-semibold line-clamp-1 ${playingLessonId === lesson.id ? 'text-primary' : ''}`}>{lesson.title}</span>
                              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${lesson.isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {!lesson.isFree && <Lock className="size-3" />}
                                {lesson.isFree ? 'FREE' : 'PAID'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </ScrollReveal>

        {/* Load More */}
        <ScrollReveal delay={200} className="flex justify-center pt-8">
           <Button variant="outline" className="rounded-xl px-10 h-14 font-bold bg-white/40 border-white/60 hover:bg-white/80 shadow-sm text-base">
             Xem Thêm Khoá Học
           </Button>
        </ScrollReveal>

      </main>
      <SharedFooter />
    </div>
  );
}
