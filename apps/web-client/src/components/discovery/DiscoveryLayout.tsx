'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { FilterSidebar } from './FilterSidebar';
import { SortDropdown } from './SortDropdown';
import { CourseGrid } from './CourseGrid';
import { Pagination } from './Pagination';
import type { DiscoveryData, CategoryDto } from '@/app/actions/discovery';

interface DiscoveryLayoutProps {
  data: DiscoveryData | null;
  categories: CategoryDto[];
}

export function DiscoveryLayout({ data, categories }: DiscoveryLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const courses = data?.courses ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const limit = data?.limit ?? 12;
  const levels = data?.filters?.levels ?? ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const filterCategories =
    data?.filters?.categories && data.filters.categories.length > 0
      ? data.filters.categories
      : categories;

  return (
    <>
      {/* Hero + Search */}
      <div className="flex flex-col items-center text-center space-y-6 pt-10 pb-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance">
          Khám Phá <span className="text-primary">Khoá Học</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl font-medium">
          Tìm kiếm và lọc qua hàng trăm khoá học chất lượng cao từ các chuyên gia công nghệ hàng đầu.
        </p>
        <SearchBar />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <p className="text-sm text-muted-foreground font-medium">
          Hiển thị <span className="font-bold text-foreground">{courses.length}</span> / {total} khoá học
        </p>
        <div className="flex items-center gap-3">
          <SortDropdown />
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white/80 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Bộ lọc
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-8 pt-6">
        {/* Sidebar – desktop always visible, mobile toggle */}
        <div
          className={`${
            sidebarOpen ? 'fixed inset-0 z-50 bg-black/40 lg:relative lg:bg-transparent' : 'hidden lg:block'
          } lg:w-64 lg:shrink-0`}
        >
          <div
            className={`${
              sidebarOpen
                ? 'fixed right-0 top-0 h-full w-80 bg-background shadow-2xl p-6 overflow-y-auto z-50'
                : ''
            } lg:relative lg:w-auto lg:shadow-none lg:p-0 lg:bg-transparent`}
          >
            {sidebarOpen && (
              <div className="flex items-center justify-between mb-6 lg:hidden">
                <h3 className="text-lg font-bold">Bộ lọc</h3>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <FilterSidebar categories={filterCategories} levels={levels} />
          </div>
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <CourseGrid courses={courses} />
          </div>
          <Pagination total={total} page={page} limit={limit} />
        </div>
      </div>
    </>
  );
}
