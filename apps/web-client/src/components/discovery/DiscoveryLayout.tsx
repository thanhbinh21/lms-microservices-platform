'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import type { CategoryDto, DiscoveryData } from '@/app/actions/discovery';
import { Button } from '@/components/ui/button';
import { PublicPageHeader, PublicState } from '@/components/shared/public-page';
import { CourseGrid } from './CourseGrid';
import { FilterSidebar } from './FilterSidebar';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';
import { SortDropdown } from './SortDropdown';

interface DiscoveryLayoutProps {
  data: DiscoveryData | null;
  categories: CategoryDto[];
}

export function DiscoveryLayout({ data, categories }: DiscoveryLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!data) {
    return (
      <div className="space-y-8">
        <PublicPageHeader
          centered
          eyebrow="Khám phá"
          title={<><span className="text-primary">Khóa học</span> NexEdu</>}
          description="Không thể tải danh sách khóa học lúc này. Vui lòng thử lại sau."
        />
        <PublicState
          variant="error"
          title="Không tải được dữ liệu khóa học"
          description="Dịch vụ khóa học có thể đang khởi động hoặc mất kết nối tạm thời."
        />
      </div>
    );
  }

  const courses = data.courses ?? [];
  const total = data.total ?? 0;
  const page = data.page ?? 1;
  const limit = data.limit ?? 12;
  const levels = data.filters?.levels?.length ? data.filters.levels : ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const filterCategories = data.filters?.categories?.length ? data.filters.categories : categories;

  return (
    <div className="space-y-8">
      <PublicPageHeader
        centered
        eyebrow="Khám phá"
        title={<><span className="text-primary">Khóa học</span> theo mục tiêu của bạn</>}
        description="Tìm kiếm, lọc theo danh mục, trình độ, giá và đánh giá để chọn khóa học phù hợp nhất."
        actions={<SearchBar />}
      />

      <div className="glass-panel flex flex-col gap-3 rounded-2xl border-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          Hiển thị <span className="text-foreground">{courses.length}</span> / {total} khóa học
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SortDropdown />
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl bg-white/70 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Filter className="size-4" />
            Bộ lọc
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="glass-panel rounded-2xl border-white/70 p-5">
            <FilterSidebar categories={filterCategories} levels={levels} />
          </div>
        </aside>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Đóng bộ lọc"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute right-0 top-0 h-full w-[min(22rem,92vw)] overflow-y-auto bg-background p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Bộ lọc khóa học</h2>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Đóng bộ lọc">
                  <X className="size-5" />
                </Button>
              </div>
              <FilterSidebar categories={filterCategories} levels={levels} />
            </aside>
          </div>
        ) : null}

        <section className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <CourseGrid courses={courses} />
          </div>
          <Pagination total={total} page={page} limit={limit} />
        </section>
      </div>
    </div>
  );
}
