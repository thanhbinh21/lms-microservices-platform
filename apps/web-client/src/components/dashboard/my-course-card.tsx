import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { BookOpen, Trophy } from 'lucide-react';
import Link from 'next/link';

interface MyCourseCardProps {
  course: any;
  delay?: number;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.ceil((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}ph`;
  return `${m} phút`;
}

export function MyCourseCard({ course, delay = 0 }: MyCourseCardProps) {
  return (
    <ScrollReveal delay={delay}>
      <Card className="glass-panel glass-card-hover rounded-2xl border-white/60 flex flex-col overflow-hidden group">
        <div className="aspect-video bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))] relative overflow-hidden">
          {course.thumbnail ? (
            <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="size-12 text-primary/20" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            {course.enrollmentType === 'FREE' && (
              <span className="rounded-full bg-emerald-500/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Miễn phí
              </span>
            )}
            <span className="rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold text-primary shadow-sm border border-primary/10">
              {course.level}
            </span>
          </div>
          {course.progressPercent === 100 && (
            <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
              <div className="size-14 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Trophy className="size-7 text-white" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col flex-1 space-y-3">
          <div className="flex-1 min-h-0">
            <h3 className="text-sm font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {course.title}
            </h3>
            <p className="text-[11px] text-muted-foreground font-medium mt-1.5">
              {course.completedLessons}/{course.totalLessons} bài · {formatDuration(course.totalWatchedSeconds)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Tiến độ</span>
              <span className={course.progressPercent === 100 ? 'text-emerald-600' : 'text-primary'}>
                {course.progressPercent}%
              </span>
            </div>
            <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  course.progressPercent === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-primary'
                }`}
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>
          </div>

          <Link href={`/learn/${course.courseId}`} className="pt-2 block">
            <div className="w-full py-2.5 rounded-xl border-2 border-primary/10 bg-primary/5 text-primary text-xs font-bold text-center hover:bg-primary hover:text-white transition-colors">
              {course.progressPercent === 100 ? 'Ôn tập lại' : course.progressPercent > 0 ? 'Học tiếp tục' : 'Bắt đầu học'}
            </div>
          </Link>
        </div>
      </Card>
    </ScrollReveal>
  );
}
