'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Search, Filter, Star, Clock, User, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicCoursesAction, type CourseDto } from '@/app/actions/instructor';

interface CourseCardView {
  id: string;
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

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseCardView[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="glass-page min-h-screen text-foreground pb-24 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-10%] w-[35%] h-[40%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      {/* Header Navbar (Static for Public pages) */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/50 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={40} height={40} priority />
            <span className="text-xl font-bold tracking-tight">NexEdu</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors pb-1">Trang chủ</Link>
            <Link href="/courses" className="text-primary border-b-2 border-primary pb-1">Khoá học</Link>
            <Link href="#" className="hover:text-primary transition-colors pb-1">Giảng viên</Link>
            <Link href="#" className="hover:text-primary transition-colors pb-1">Blog</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="font-bold">Đăng nhập</Button>
            </Link>
            <Link href="/register">
              <Button className="font-bold shadow-md shadow-primary/20">Đăng ký</Button>
            </Link>
          </div>
        </div>
      </header>

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
                      <Button variant="ghost" className="rounded-full size-10 p-0 text-primary hover:bg-primary/10">
                         <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  
                </div>

              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Load More */}
        <ScrollReveal delay={200} className="flex justify-center pt-8">
           <Button variant="outline" className="rounded-xl px-10 h-14 font-bold bg-white/40 border-white/60 hover:bg-white/80 shadow-sm text-base">
             Xem Thêm Khoá Học
           </Button>
        </ScrollReveal>

      </main>
    </div>
  );
}
