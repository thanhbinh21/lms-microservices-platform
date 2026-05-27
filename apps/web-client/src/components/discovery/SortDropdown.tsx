'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'rating', label: 'Đánh giá cao' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
];

export function SortDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('sortBy') || 'newest';

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'newest') params.delete('sortBy');
    else params.set('sortBy', value);
    params.delete('page');
    router.push(`/courses?${params.toString()}`);
  };

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur-md">
      <ArrowUpDown className="size-4 text-muted-foreground" />
      <span className="sr-only">Sắp xếp khóa học</span>
      <select
        value={current}
        onChange={(event) => handleChange(event.target.value)}
        className="bg-transparent text-sm font-semibold outline-none"
        aria-label="Sắp xếp khóa học"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
