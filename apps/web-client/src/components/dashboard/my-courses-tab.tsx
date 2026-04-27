import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Button } from '@/components/ui/button';
import { Sparkles, Filter, SortAsc, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { MyCourseCard } from './my-course-card';

type CourseFilter = 'all' | 'in-progress' | 'completed';
type CourseSort = 'recent' | 'progress';

interface MyCoursesTabProps {
  myCourses: any[];
  filteredCourses: any[];
  courseFilter: CourseFilter;
  setCourseFilter: (filter: CourseFilter) => void;
  courseSort: CourseSort;
  setCourseSort: (sort: CourseSort) => void;
}

export function MyCoursesTab({
  myCourses,
  filteredCourses,
  courseFilter,
  setCourseFilter,
  courseSort,
  setCourseSort
}: MyCoursesTabProps) {
  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <ScrollReveal>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Khóa học của tôi</h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              {myCourses.length} khóa học · {myCourses.filter((c) => c.progressPercent === 100).length} hoàn thành
            </p>
          </div>
          <Link href="/courses">
            <Button variant="outline" className="gap-2 rounded-xl border-primary/30 font-bold">
              <Sparkles className="size-4" />
              Khám phá thêm
            </Button>
          </Link>
        </div>
      </ScrollReveal>

      {/* Filter + Sort Bar */}
      <ScrollReveal delay={50}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
            <Filter className="size-3.5" />
          </div>
          {([
            ['all', 'Tất cả'],
            ['in-progress', 'Đang học'],
            ['completed', 'Hoàn thành'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCourseFilter(key)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                courseFilter === key
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white/50 text-muted-foreground hover:bg-white/80 border border-white/60'
              }`}
            >
              {label}
              {key === 'all' && ` (${myCourses.length})`}
              {key === 'in-progress' && ` (${myCourses.filter((c) => c.progressPercent < 100).length})`}
              {key === 'completed' && ` (${myCourses.filter((c) => c.progressPercent === 100).length})`}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <SortAsc className="size-3.5 text-muted-foreground" />
            <select
              value={courseSort}
              onChange={(e) => setCourseSort(e.target.value as CourseSort)}
              className="text-xs font-semibold bg-white/50 border border-white/60 rounded-lg px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="recent">Mới truy cập</option>
              <option value="progress">Tiến độ</option>
            </select>
          </div>
        </div>
      </ScrollReveal>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <ScrollReveal>
          <div className="py-6">
            <EmptyState
              icon={BookOpen}
              title={courseFilter === 'all' ? 'Bạn chưa đăng ký khóa học nào' : courseFilter === 'in-progress' ? 'Không có khóa đang học' : 'Chưa hoàn thành khóa nào'}
              description={courseFilter === 'all'
                ? 'Hãy khám phá kho khóa học đa dạng và bắt đầu hành trình học tập ngay!'
                : 'Thử thay đổi bộ lọc hoặc khám phá thêm khóa học mới.'}
              actionLabel="Khám phá khóa học"
              actionHref="/courses"
            />
          </div>
        </ScrollReveal>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course, idx) => (
            <MyCourseCard key={course.id} course={course} delay={idx * 80} />
          ))}
        </div>
      )}
    </div>
  );
}
