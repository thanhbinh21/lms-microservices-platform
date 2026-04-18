'use client';

import Link from 'next/link';
import { Star, Clock, Users, BookOpen } from 'lucide-react';
import type { DiscoveryCourse } from '@/app/actions/discovery';

interface CourseGridProps {
  courses: DiscoveryCourse[];
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: 'bg-emerald-100 text-emerald-700',
  INTERMEDIATE: 'bg-blue-100 text-blue-700',
  ADVANCED: 'bg-purple-100 text-purple-700',
};

function CourseCard({ course }: { course: DiscoveryCourse }) {
  const priceLabel =
    Number(course.price) === 0
      ? 'Miễn phí'
      : `${Number(course.price).toLocaleString('vi-VN')}đ`;

  const hours = Math.max(1, Math.floor(course.totalDuration / 3600));
  const initials = (
    course.title.match(/[A-Za-z]/g)?.slice(0, 3).join('') || 'CRS'
  ).toUpperCase();

  return (
    <Link href={`/courses/${course.slug}`} className="block h-full">
      <div className="glass-panel group rounded-3xl border-white/60 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1.5 transition-all duration-300 flex flex-col overflow-hidden h-full">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 border-b border-white/50 flex items-center justify-center overflow-hidden">
          {course.thumbnail?.trim() ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={course.thumbnail}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </>
          ) : (
            <span className="text-5xl font-black text-primary/20 tracking-tighter group-hover:scale-110 transition-transform duration-500">
              {initials}
            </span>
          )}

          {/* Level badge */}
          <span
            className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full ${LEVEL_COLORS[course.level] || 'bg-gray-100 text-gray-600'}`}
          >
            {LEVEL_LABELS[course.level] || course.level}
          </span>

          {/* Category badge */}
          {course.category && (
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-foreground">
              {course.category.name}
            </span>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="size-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40">
              <div className="w-0 h-0 border-t-7 border-t-transparent border-l-12 border-l-white border-b-7 border-b-transparent ml-1" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-lg font-bold leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-2">
            {course.title}
          </h3>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-amber-500 font-bold text-sm">
              {course.averageRating > 0 ? course.averageRating.toFixed(1) : '—'}
            </span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= Math.floor(course.averageRating)
                      ? 'fill-amber-500 text-amber-500'
                      : 'fill-muted text-muted'
                  }`}
                />
              ))}
            </div>
            {course.ratingCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({course.ratingCount})
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pt-3 border-t border-border/40">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {hours} giờ
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> {course.totalLessons} bài
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {course.enrollmentCount}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span
                className={`text-lg font-black ${
                  Number(course.price) === 0 ? 'text-emerald-600' : 'text-primary'
                }`}
              >
                {priceLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CourseGrid({ courses }: CourseGridProps) {
  if (courses.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">
          Không tìm thấy kết quả
        </h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc để xem thêm khóa học.
        </p>
      </div>
    );
  }

  return (
    <>
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </>
  );
}
