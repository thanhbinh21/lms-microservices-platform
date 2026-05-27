'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { CategoryDto } from '@/app/actions/discovery';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterSidebarProps {
  categories: CategoryDto[];
  levels: string[];
}

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Cơ bản',
  INTERMEDIATE: 'Trung cấp',
  ADVANCED: 'Nâng cao',
};

const PRICE_PRESETS = [
  { label: 'Tất cả mức giá', min: undefined, max: undefined, key: 'all' },
  { label: 'Miễn phí', min: 0, max: 0, key: 'free' },
  { label: 'Dưới 200K', min: undefined, max: 200000, key: 'under200' },
  { label: '200K - 500K', min: 200000, max: 500000, key: '200to500' },
  { label: 'Trên 500K', min: 500000, max: undefined, key: 'over500' },
];

const RATING_PRESETS = [
  { label: 'Từ 4 sao', value: 4 },
  { label: 'Từ 3 sao', value: 3 },
  { label: 'Từ 2 sao', value: 2 },
];

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function FilterSidebar({ categories, levels }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get('category') || '';
  const currentLevel = searchParams.get('level') || '';
  const currentMinPrice = searchParams.get('minPrice') || '';
  const currentMaxPrice = searchParams.get('maxPrice') || '';
  const currentMinRating = searchParams.get('minRating') || '';

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete('page');
    router.push(`/courses?${params.toString()}`);
  };

  const setFilter = (key: string, value: string) => {
    updateParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  };

  const setPriceRange = (min?: number, max?: number) => {
    updateParams((params) => {
      if (min !== undefined) params.set('minPrice', String(min));
      else params.delete('minPrice');
      if (max !== undefined) params.set('maxPrice', String(max));
      else params.delete('maxPrice');
    });
  };

  const clearAll = () => {
    const params = new URLSearchParams();
    const query = searchParams.get('q');
    if (query) params.set('q', query);
    router.push(`/courses?${params.toString()}`);
  };

  const hasFilters = Boolean(currentCategory || currentLevel || currentMinPrice || currentMaxPrice || currentMinRating);
  const activePriceKey =
    PRICE_PRESETS.find((preset) => {
      if (preset.key === 'all') return !currentMinPrice && !currentMaxPrice;
      if (preset.key === 'free') return currentMinPrice === '0' && currentMaxPrice === '0';
      return (
        (preset.min !== undefined ? currentMinPrice === String(preset.min) : !currentMinPrice) &&
        (preset.max !== undefined ? currentMaxPrice === String(preset.max) : !currentMaxPrice)
      );
    })?.key || 'all';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Bộ lọc</h2>
        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary" onClick={clearAll}>
            <X className="size-3" />
            Xóa lọc
          </Button>
        ) : null}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-bold">Danh mục</h3>
        <FilterButton active={!currentCategory} onClick={() => setFilter('category', '')}>
          <span>Tất cả danh mục</span>
        </FilterButton>
        {categories.map((category) => (
          <FilterButton key={category.slug} active={currentCategory === category.slug} onClick={() => setFilter('category', category.slug)}>
            <span className="truncate">{category.name}</span>
            <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[11px]">{category.courseCount}</span>
          </FilterButton>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold">Giá</h3>
        {PRICE_PRESETS.map((preset) => (
          <FilterButton key={preset.key} active={activePriceKey === preset.key} onClick={() => setPriceRange(preset.min, preset.max)}>
            <span>{preset.label}</span>
          </FilterButton>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold">Đánh giá</h3>
        <FilterButton active={!currentMinRating} onClick={() => setFilter('minRating', '')}>
          <span>Tất cả đánh giá</span>
        </FilterButton>
        {RATING_PRESETS.map((preset) => (
          <FilterButton
            key={preset.value}
            active={currentMinRating === String(preset.value)}
            onClick={() => setFilter('minRating', currentMinRating === String(preset.value) ? '' : String(preset.value))}
          >
            <span>{preset.label}</span>
          </FilterButton>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold">Trình độ</h3>
        <FilterButton active={!currentLevel} onClick={() => setFilter('level', '')}>
          <span>Tất cả trình độ</span>
        </FilterButton>
        {levels.map((level) => (
          <FilterButton key={level} active={currentLevel === level} onClick={() => setFilter('level', currentLevel === level ? '' : level)}>
            <span>{LEVEL_LABELS[level] || level}</span>
          </FilterButton>
        ))}
      </section>
    </div>
  );
}
