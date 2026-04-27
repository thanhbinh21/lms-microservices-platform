import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import Link from 'next/link';

interface OverviewCourseCardProps {
  course: any;
  delay?: number;
}

export function OverviewCourseCard({ course, delay = 0 }: OverviewCourseCardProps) {
  return (
    <ScrollReveal delay={delay}>
      <Card className="glass-panel glass-card-hover rounded-2xl border-white/60 p-4 md:p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="w-full md:w-48 aspect-video rounded-xl border border-white/50 shadow-inner shrink-0 overflow-hidden bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))]">
          {course.thumbnail ? (
            <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl font-bold text-primary/30 uppercase tracking-widest">
                {(course.title?.match(/[A-Za-z]/g)?.slice(0, 2).join('') || 'CRS').toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 w-full space-y-4">
          <div>
            <p className="text-xs font-semibold text-primary mb-1">Giảng viên: {course.instructor}</p>
            <h3 className="text-lg font-bold leading-tight">{course.title}</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Hoàn thành {course.progress}%</span>
              <span>Truy cập: {course.lastAccessed}</span>
            </div>
            <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${course.progress}%` }} />
            </div>
          </div>
        </div>
        <div className="w-full md:w-auto shrink-0 flex items-center md:items-end md:h-full">
          <Link href={`/learn/${course.id}`} className="w-full md:w-auto">
            <Button className="w-full rounded-xl shadow-md cursor-pointer pointer-events-auto z-10" onClick={(e) => e.stopPropagation()}>Học tiếp tục</Button>
          </Link>
        </div>
      </Card>
    </ScrollReveal>
  );
}
