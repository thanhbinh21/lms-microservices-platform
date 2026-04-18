'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  X,
  ChevronDown,
  Search,
  Check,
  LayoutGrid,
  Globe,
  Server,
  Smartphone,
  Container,
  Network,
  BarChart3,
  Brain,
  Database,
  Shield,
  Cog,
  Users,
  Layers,
} from 'lucide-react';
import type { CategoryDto } from '@/app/actions/discovery';

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
  { label: 'Tất cả', min: undefined, max: undefined, key: 'all' },
  { label: 'Miễn phí', min: 0, max: 0, key: 'free' },
  { label: 'Dưới 200K', min: undefined, max: 200000, key: 'under200' },
  { label: '200K – 500K', min: 200000, max: 500000, key: '200to500' },
  { label: 'Trên 500K', min: 500000, max: undefined, key: 'over500' },
];

const RATING_PRESETS = [
  { label: '4+ sao', value: 4 },
  { label: '3+ sao', value: 3 },
  { label: '2+ sao', value: 2 },
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'web-frontend': Globe,
  'web-backend': Server,
  mobile: Smartphone,
  devops: Container,
  'system-design': Network,
  'data-science': BarChart3,
  'ai-ml': Brain,
  database: Database,
  security: Shield,
  automation: Cog,
  'soft-skills': Users,
};

function CategoryCombobox({
  categories,
  current,
  onChange,
}: {
  categories: CategoryDto[];
  current: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCat = categories.find((c) => c.slug === current);

  const filtered = search.trim()
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : categories;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
      setSearch('');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const select = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setSearch('');
  };

  const SelectedIcon = current ? CATEGORY_ICONS[current] || Layers : LayoutGrid;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all border ${
          open
            ? 'border-primary/50 ring-2 ring-primary/20 bg-white shadow-lg shadow-primary/5'
            : current
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-white/80 bg-white/70 backdrop-blur-md hover:border-primary/30 hover:bg-white/90'
        }`}
      >
        <SelectedIcon className="w-4 h-4 shrink-0 opacity-70" />
        <span className="flex-1 text-left truncate">
          {selectedCat ? selectedCat.name : 'Tất cả danh mục'}
        </span>
        {current && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              select('');
            }}
            className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 shrink-0 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-white/80 bg-white shadow-2xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search input */}
          <div className="p-2 border-b border-border/40">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm danh mục..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {/* "All" option */}
            <button
              type="button"
              onClick={() => select('')}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                !current
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted/70 text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0 opacity-60" />
              <span className="flex-1 text-left">Tất cả danh mục</span>
              {!current && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                Không tìm thấy danh mục
              </p>
            )}

            {filtered.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.slug] || Layers;
              const isActive = current === cat.slug;

              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => select(cat.slug)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/70 text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-60" />
                  <span className="flex-1 text-left truncate">{cat.name}</span>
                  {cat.courseCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {cat.courseCount}
                    </span>
                  )}
                  {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
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

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/courses?${params.toString()}`);
  };

  const setPriceRange = (min?: number, max?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (min !== undefined) params.set('minPrice', String(min));
    else params.delete('minPrice');
    if (max !== undefined) params.set('maxPrice', String(max));
    else params.delete('maxPrice');
    params.delete('page');
    router.push(`/courses?${params.toString()}`);
  };

  const clearAll = () => {
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) params.set('q', q);
    router.push(`/courses?${params.toString()}`);
  };

  const hasFilters =
    currentCategory || currentLevel || currentMinPrice || currentMaxPrice || currentMinRating;

  const activePriceKey =
    PRICE_PRESETS.find((p) => {
      if (p.key === 'all') return !currentMinPrice && !currentMaxPrice;
      if (p.key === 'free') return currentMinPrice === '0' && currentMaxPrice === '0';
      return (
        (p.min !== undefined ? currentMinPrice === String(p.min) : !currentMinPrice) &&
        (p.max !== undefined ? currentMaxPrice === String(p.max) : !currentMaxPrice)
      );
    })?.key || 'all';

  return (
    <aside className="space-y-6">
      {hasFilters && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Bộ lọc đang dùng</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Xóa tất cả
          </button>
        </div>
      )}

      {/* Categories — custom combobox */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-2">Danh mục</h4>
        <CategoryCombobox
          categories={categories}
          current={currentCategory}
          onChange={(slug) => setFilter('category', slug)}
        />
      </div>

      {/* Price */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-3">Giá</h4>
        <div className="space-y-1.5">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setPriceRange(preset.min, preset.max)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activePriceKey === preset.key
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-3">Đánh giá</h4>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setFilter('minRating', '')}
            className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              !currentMinRating
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            Tất cả
          </button>
          {RATING_PRESETS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() =>
                setFilter(
                  'minRating',
                  currentMinRating === String(r.value) ? '' : String(r.value),
                )
              }
              className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                currentMinRating === String(r.value)
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <span className="text-amber-500">
                {'★'.repeat(r.value)}
                {'☆'.repeat(5 - r.value)}
              </span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-3">Trình độ</h4>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setFilter('level', '')}
            className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              !currentLevel
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            Tất cả
          </button>
          {levels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setFilter('level', currentLevel === lvl ? '' : lvl)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                currentLevel === lvl
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {LEVEL_LABELS[lvl] || lvl}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
