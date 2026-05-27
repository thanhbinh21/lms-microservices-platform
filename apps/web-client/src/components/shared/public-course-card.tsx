import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, CheckCircle2, Clock3, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface PublicCourseCardData {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnail?: string | null;
  price?: number | string | null;
  level?: string | null;
  totalLessons?: number | null;
  totalDuration?: number | null;
  averageRating?: number | null;
  ratingCount?: number | null;
  enrollmentCount?: number | null;
  category?: { name: string; slug?: string } | null;
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

function formatPrice(price?: number | string | null) {
  const value = Number(price || 0);
  if (value <= 0) return 'Miễn phí';
  return `${value.toLocaleString('vi-VN')}đ`;
}

function formatDuration(seconds?: number | null) {
  const total = Number(seconds || 0);
  if (!total) return 'Cập nhật';
  const minutes = Math.max(1, Math.ceil(total / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours}h ${remain}p` : `${hours}h`;
}

function initials(title: string) {
  const letters = title.match(/[A-Za-zÀ-ỹ]/g)?.slice(0, 3).join('') || 'NXE';
  return letters.toUpperCase();
}

interface PublicCourseCardProps {
  course: PublicCourseCardData;
  isEnrolled?: boolean;
  action?: ReactNode;
  className?: string;
}

export function PublicCourseCard({ course, isEnrolled = false, action, className }: PublicCourseCardProps) {
  const levelLabel = LEVEL_LABELS[String(course.level || '').toUpperCase()] || course.level || 'Cập nhật';
  const rating = Number(course.averageRating || 0);
  const price = Number(course.price || 0);

  return (
    <Link href={`/courses/${course.slug}`} className={cn('group block h-full', className)}>
      <article className="glass-panel glass-card-hover flex h-full flex-col overflow-hidden rounded-2xl border-white/70">
        <div className="relative aspect-video overflow-hidden border-b border-white/60 bg-primary/10">
          {course.thumbnail ? (
            // Anh khoa hoc co domain dong nen dung img de tranh chan host chua allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl font-black tracking-tight text-primary/25">
              {initials(course.title)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/45 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge className="border-none bg-white/90 text-primary hover:bg-white">{levelLabel}</Badge>
            {course.category?.name ? (
              <Badge variant="secondary" className="bg-white/80 text-foreground hover:bg-white">
                {course.category.name}
              </Badge>
            ) : null}
          </div>
          {isEnrolled ? (
            <Badge className="absolute bottom-3 left-3 gap-1 border-none bg-emerald-600 hover:bg-emerald-600">
              <CheckCircle2 className="size-3" />
              Đã ghi danh
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-base font-bold leading-snug transition-colors group-hover:text-primary">
              {course.title}
            </h3>
            {course.description ? (
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{course.description}</p>
            ) : null}
          </div>

          <div className="mt-auto space-y-4">
            <div className="grid grid-cols-3 gap-2 border-t border-white/50 pt-3 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" />
                {formatDuration(course.totalDuration)}
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-3.5" />
                {course.totalLessons || 0} bài
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {course.enrollmentCount || 0}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn('text-lg font-extrabold', price > 0 ? 'text-primary' : 'text-emerald-600')}>
                  {formatPrice(course.price)}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Star className="size-3.5 fill-current" />
                  {rating > 0 ? rating.toFixed(1) : 'Mới'} {course.ratingCount ? `(${course.ratingCount})` : ''}
                </p>
              </div>
              {action ? <div onClick={(event) => event.preventDefault()}>{action}</div> : null}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
