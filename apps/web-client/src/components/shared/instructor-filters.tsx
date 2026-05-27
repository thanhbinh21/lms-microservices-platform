'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstructorFiltersProps {
  initialQ: string;
  initialSortBy: string;
}

export function InstructorFilters({ initialQ, initialSortBy }: InstructorFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hàm cập nhật URL giữ vững các tham số query hiện có
  const updateUrl = (q: string, sortBy: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (q) params.set('q', q);
    else params.delete('q');

    if (sortBy) params.set('sortBy', sortBy);
    else params.delete('sortBy');

    // Reset về trang 1 khi lọc/tìm kiếm mới
    params.set('page', '1');

    router.push(`/instructors?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get('q') as string || '').trim();
    const sortBy = formData.get('sortBy') as string || 'newest';
    updateUrl(q, sortBy);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sortBy = e.target.value;
    const q = searchParams.get('q') || '';
    updateUrl(q, sortBy);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel flex flex-col gap-3 rounded-2xl border-white/70 p-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="relative flex-1 lg:max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={initialQ}
          placeholder="Tìm theo tên hoặc chuyên môn..."
          className="h-11 w-full rounded-xl border border-white/80 bg-white/70 pl-9 pr-4 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          aria-label="Tìm giảng viên"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sortBy" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <SlidersHorizontal className="size-4" />
          Sắp xếp
        </label>
        <select
          id="sortBy"
          name="sortBy"
          defaultValue={initialSortBy}
          onChange={handleSortChange}
          className="h-10 rounded-xl border border-white/80 bg-white/70 px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="newest">Mới nhất</option>
          <option value="courses">Nhiều khóa học nhất</option>
          <option value="rating">Đánh giá cao nhất</option>
        </select>
        <Button type="submit" className="h-10 rounded-xl font-semibold">Áp dụng</Button>
      </div>
    </form>
  );
}
